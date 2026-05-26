// Authentication DTOs

export interface RegisterRequestDTO {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface AuthResponseDTO {
  success: true;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    token: string;
  };
}

export interface MeResponseDTO {
  success: true;
  data: {
    id: string;
    email: string;
    name?: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
}
