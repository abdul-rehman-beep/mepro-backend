import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const commentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    content: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const communityPostSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true, maxlength: 60 },
    authorAvatarUrl: { type: String, default: null },

    content: { type: String, required: true, maxlength: 2000 },

    /** Optional link into the app so posts can reference a workout or achievement. */
    postType: { type: String, enum: ['update', 'question', 'achievement', 'tip'], default: 'update' },
    category: { type: String, default: 'general', index: true },
    relatedWorkoutId: { type: Schema.Types.ObjectId, ref: 'Workout', default: null },

    imageUrls: { type: [String], default: [] },

    likes: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    likeCount: { type: Number, default: 0, index: true },
    commentCount: { type: Number, default: 0 },

    comments: { type: [commentSchema], default: [] },

    isHidden: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    reports: {
      type: [
        new Schema(
          { userId: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, createdAt: { type: Date, default: Date.now } },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

communityPostSchema.index({ createdAt: -1 });
communityPostSchema.index({ userId: 1, createdAt: -1 });
communityPostSchema.index({ isHidden: 1, likeCount: -1, createdAt: -1 });
communityPostSchema.index({ content: 'text' });

export type CommunityPostAttributes = InferSchemaType<typeof communityPostSchema>;
export type CommunityPostDocument = HydratedDocument<CommunityPostAttributes>;
export type CommunityPostModel = Model<CommunityPostAttributes>;

export const CommunityPost = model<CommunityPostAttributes>(
  'CommunityPost',
  communityPostSchema,
) as CommunityPostModel;

export const MAX_COMMENTS_PER_POST = 200;
