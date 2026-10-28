import type { QueryFilter } from 'mongoose';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CommunityPost, MAX_COMMENTS_PER_POST, type CommunityPostAttributes } from '../models/CommunityPost';
import { User } from '../models/User';
import { sendCreated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { getPagination, containsFilter } from '../utils/pagination';
import { toObjectId } from '../services/workout.service';
import { createNotification } from '../services/notification.service';

export async function list(req: Request, res: Response): Promise<Response> {
  const query = req.query as { page?: unknown; limit?: unknown; category?: string; postType?: string; search?: string; sort?: string };
  const { page, limit, skip } = getPagination(query);

  const filter: QueryFilter<CommunityPostAttributes> = { isHidden: false };
  if (query.category) filter.category = query.category;
  if (query.postType) filter.postType = query.postType as never;

  if (query.search) {
    filter.content = containsFilter('content', query.search).content as never;
  }

  const sort = query.sort === 'popular' ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    CommunityPost.find(filter)
      .sort(sort as never)
      .skip(skip)
      .limit(limit)
      .select('-comments -reports')
      .lean(),
    CommunityPost.countDocuments(filter),
  ]);

  // Return whether the requesting user already liked each post so the client
  // does not have to fetch each post individually to render the heart state.
  const withLiked = await Promise.all(
    items.map(async (post) => {
      const liked = (post.likes ?? []).some((userId) => userId.toString() === req.user!.id);
      const { likes, ...rest } = post as unknown as Record<string, unknown>;
      return { ...rest, likeCount: post.likeCount ?? 0, likedByMe: liked, likesCount: (likes as unknown[])?.length ?? post.likeCount ?? 0 };
    }),
  );

  return sendSuccess(
    res,
    { items: withLiked, page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
    'Community posts',
  );
}

export async function create(req: Request, res: Response): Promise<Response> {
  const user = await User.findById(req.user!.id).select('name avatarUrl').lean();
  if (!user) throw ApiError.notFound('User not found');

  const post = await CommunityPost.create({
    userId: req.user!.id,
    authorName: user.name,
    authorAvatarUrl: user.avatarUrl ?? null,
    content: req.body.content,
    postType: req.body.postType,
    category: req.body.category,
    relatedWorkoutId: req.body.relatedWorkoutId ?? null,
    imageUrls: req.body.imageUrls ?? [],
  });

  return sendCreated(res, post, 'Posted');
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const post = await CommunityPost.findOne({ _id: toObjectId(req.params.id, 'postId'), isHidden: false })
    .select('-reports')
    .lean();
  if (!post) throw ApiError.notFound('Post not found');

  const likedByMe = (post.likes ?? []).some((userId) => userId.toString() === req.user!.id);
  const { likes: _likes, ...rest } = post as unknown as Record<string, unknown>;

  return sendSuccess(res, { ...rest, likedByMe, likesCount: post.likes?.length ?? 0 }, 'Post');
}

export async function remove(req: Request, res: Response): Promise<Response> {
  const post = await CommunityPost.findOneAndDelete({
    _id: toObjectId(req.params.id, 'postId'),
    userId: req.user!.id,
  });
  if (!post) throw ApiError.notFound('Post not found or you can only delete your own posts');
  return sendSuccess(res, { deleted: true }, 'Post deleted');
}

export async function toggleLike(req: Request, res: Response): Promise<Response> {
  const postId = toObjectId(req.params.id, 'postId');
  const userObjectId = new mongoose.Types.ObjectId(String(req.user!.id));

  // Try adding first; if it was already liked the match fails and we remove.
  const added = await CommunityPost.findOneAndUpdate(
    { _id: postId, isHidden: false, likes: { $ne: userObjectId } },
    { $addToSet: { likes: userObjectId } },
    { returnDocument: 'after' },
  ).select('likes likeCount');

  if (added) {
    const count = added.likes?.length ?? 0;
    await CommunityPost.updateOne({ _id: postId }, { $set: { likeCount: count } });
    return sendSuccess(res, { liked: true, likeCount: count }, 'Liked');
  }

  const removed = await CommunityPost.findOneAndUpdate(
    { _id: postId, likes: userObjectId },
    { $pull: { likes: userObjectId } },
    { returnDocument: 'after' },
  ).select('likes');

  if (!removed) throw ApiError.notFound('Post not found');

  const count = removed.likes?.length ?? 0;
  await CommunityPost.updateOne({ _id: postId }, { $set: { likeCount: count } });
  return sendSuccess(res, { liked: false, likeCount: count }, 'Like removed');
}

export async function addComment(req: Request, res: Response): Promise<Response> {
  const postId = toObjectId(req.params.id, 'postId');
  const post = await CommunityPost.findOne({ _id: postId, isHidden: false }).lean();
  if (!post) throw ApiError.notFound('Post not found');
  if ((post.comments?.length ?? 0) >= MAX_COMMENTS_PER_POST) {
    throw ApiError.badRequest('This post has reached its comment limit');
  }

  const user = await User.findById(req.user!.id).select('name').lean();
  if (!user) throw ApiError.notFound('User not found');

  const comment = { userId: req.user!.id, userName: user.name, content: req.body.content, createdAt: new Date() };

  const updated = await CommunityPost.findOneAndUpdate(
    { _id: postId, isHidden: false },
    { $push: { comments: comment }, $inc: { commentCount: 1 } },
    { returnDocument: 'after' },
  )
    .select('comments commentCount')
    .lean();

  // Notify the author, unless they are commenting on their own post.
  if (post.userId.toString() !== req.user!.id) {
    await createNotification({
      userId: post.userId.toString(),
      type: 'motivation',
      title: `${user.name} commented on your post`,
      body: req.body.content.slice(0, 120),
      icon: 'chat',
      actionUrl: `/community/${postId}`,
      actionLabel: 'Reply',
      data: { postId: postId.toString() },
    }).catch(() => undefined);
  }

  return sendCreated(res, { comment, commentCount: updated?.commentCount ?? 0 }, 'Comment added');
}

export async function listComments(req: Request, res: Response): Promise<Response> {
  const post = await CommunityPost.findOne({ _id: toObjectId(req.params.id, 'postId') })
    .select('comments commentCount')
    .lean();
  if (!post) throw ApiError.notFound('Post not found');
  return sendSuccess(res, { comments: post.comments ?? [], total: post.commentCount ?? 0 }, 'Comments');
}

export async function report(req: Request, res: Response): Promise<Response> {
  const postId = toObjectId(req.params.id, 'postId');
  const userObjectId = new mongoose.Types.ObjectId(String(req.user!.id));

  const result = await CommunityPost.updateOne(
    { _id: postId, 'reports.userId': { $ne: userObjectId } },
    {
      $push: { reports: { userId: userObjectId, reason: req.body.reason, createdAt: new Date() } },
      $inc: { reportCount: 1 },
    },
  );

  if ((result.modifiedCount ?? 0) === 0) {
    const exists = await CommunityPost.findOne({ _id: postId, 'reports.userId': userObjectId }).lean();
    if (exists) throw ApiError.conflict('You have already reported this post');
    throw ApiError.notFound('Post not found');
  }

  // Auto-hide once reported by several different accounts, which is a cheap and
  // transparent moderation signal for a small community.
  const post = await CommunityPost.findById(postId).select('userId reportCount authorName').lean();
  if (post && post.reportCount >= 5) {
    await CommunityPost.updateOne({ _id: postId }, { $set: { isHidden: true } });
  }

  return sendSuccess(res, { reported: true }, 'Thanks, we have recorded your report');
}

export async function listMyPosts(req: Request, res: Response): Promise<Response> {
  const { page, limit, skip } = getPagination(req.query as { page?: unknown; limit?: unknown });
  const [items, total] = await Promise.all([
    CommunityPost.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-comments -reports')
      .lean(),
    CommunityPost.countDocuments({ userId: req.user!.id }),
  ]);

  return sendSuccess(
    res,
    { items, page, limit, total, totalPages: Math.ceil(total / limit) },
    'Your posts',
  );
}
