// Feed/Social System DTOs

export interface PostDTO {
  id: string;
  userId: string;
  businessId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface CreatePostDTO {
  businessId: string;
  content: string;
  imageUrl?: string;
}

export interface PostListResponseDTO {
  success: true;
  data: PostDTO[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
}
