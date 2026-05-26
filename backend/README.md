# Billboard3D API

Cloudflare Workers API backend for Billboard3D platform.

## Features

- **Authentication**: JWT-based auth with register/login/me endpoints
- **Business API**: CRUD operations for businesses with pagination and search
- **Database**: Cloudflare D1 for data persistence
- **TypeScript**: Full TypeScript support with strict typing
- **Security**: CORS, input validation, and error handling

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your configuration
```

### Database Setup

```bash
# Create D1 database
wrangler d1 create billboard3d-db

# Update wrangler.toml with the database ID
# Then run migrations
wrangler d1 execute billboard3d-db --file=./schema.sql
```

### Development

```bash
# Start development server
npm run dev

# View logs
npm run tail
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user profile

### Businesses

- `GET /businesses` - List businesses (with pagination, search, filters)
- `GET /businesses/:id` - Get single business
- `POST /businesses` - Create business (admin only)
- `PUT /businesses/:id` - Update business (admin only)
- `DELETE /businesses/:id` - Delete business (admin only)

### Health

- `GET /health` - Health check
- `GET /health/db` - Database health check

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

## Pagination

Use `page` and `limit` query parameters:

```
GET /businesses?page=1&limit=20
```

## Search & Filters

```
GET /businesses?search=advertising&city=Baghdad&category=Marketing
```

## Authentication

Include JWT token in Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Environment Variables

- `JWT_SECRET`: Secret for JWT signing
- `DB`: D1 database binding

## Project Structure

```
src/
├── index.ts          # Entry point
├── app.ts            # Hono app setup
├── types.ts          # TypeScript types
├── middleware/
│   ├── cors.ts       # CORS middleware
│   └── logger.ts     # Request logging
├── routes/
│   ├── auth.ts       # Auth routes
│   ├── businesses.ts # Business routes
│   └── health.ts     # Health check routes
├── utils/
│   ├── jwt.ts        # JWT utilities
│   ├── response.ts   # Response helpers
│   └── pagination.ts # Pagination utilities
└── db/
    └── client.ts     # Database client
```

## Deployment

The project is configured for automatic deployment via GitHub Actions when pushing to the main branch.

### Manual Deployment

```bash
npm run deploy
```

### Environment Configuration

- **Development**: Uses local wrangler.toml
- **Production**: Uses production environment in wrangler.toml
- **Staging**: Uses staging environment in wrangler.toml

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT
