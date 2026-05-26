import type { D1Database } from '@cloudflare/workers-types';

export class DatabaseClient {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // User operations
  async createUser(email: string, passwordHash: string, role = 'user') {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await this.db.prepare(`
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, email, passwordHash, role, now, now).run();

    return result.success ? id : null;
  }

  async getUserByEmail(email: string) {
    return await this.db.prepare(`
      SELECT id, email, password_hash, role, created_at, updated_at
      FROM users
      WHERE email = ?
    `).bind(email).first();
  }

  async getUserById(id: string) {
    return await this.db.prepare(`
      SELECT id, email, role, created_at, updated_at
      FROM users
      WHERE id = ?
    `).bind(id).first();
  }

  // Business operations
  async createBusiness(data: {
    name: string;
    description: string;
    category: string;
    city: string;
    country: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await this.db.prepare(`
      INSERT INTO businesses (
        id, name, description, category, city, country, website, email, phone, address,
        rating, review_count, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)
    `).bind(
      id, data.name, data.description, data.category, data.city, data.country,
      data.website, data.email, data.phone, data.address, now, now
    ).run();

    return result.success ? id : null;
  }

  async getBusinessById(id: string) {
    return await this.db.prepare(`
      SELECT * FROM businesses WHERE id = ?
    `).bind(id).first();
  }

  async getBusinesses(params: {
    limit: number;
    offset: number;
    category?: string;
    city?: string;
    search?: string;
  }) {
    let query = 'SELECT * FROM businesses WHERE is_active = 1';
    const queryParams: any[] = [];

    if (params.category) {
      query += ' AND category = ?';
      queryParams.push(params.category);
    }

    if (params.city) {
      query += ' AND city = ?';
      queryParams.push(params.city);
    }

    if (params.search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(params.limit, params.offset);

    const result = await this.db.prepare(query).bind(...queryParams).all();
    return result.results || [];
  }

  async getBusinessesCount(params: {
    category?: string;
    city?: string;
    search?: string;
  }) {
    let query = 'SELECT COUNT(*) as count FROM businesses WHERE is_active = 1';
    const queryParams: any[] = [];

    if (params.category) {
      query += ' AND category = ?';
      queryParams.push(params.category);
    }

    if (params.city) {
      query += ' AND city = ?';
      queryParams.push(params.city);
    }

    if (params.search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const result = await this.db.prepare(query).bind(...queryParams).first();
    return result?.count || 0;
  }

  async updateBusiness(id: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    city: string;
    country: string;
    website: string;
    email: string;
    phone: string;
    address: string;
    isActive: boolean;
  }>) {
    const fields = Object.keys(data);
    if (fields.length === 0) return false;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => (data as any)[field]);
    values.push(new Date().toISOString());

    const result = await this.db.prepare(`
      UPDATE businesses SET ${setClause}, updated_at = ?
      WHERE id = ?
    `).bind(...values, id).run();

    return result.success;
  }

  async deleteBusiness(id: string) {
    const result = await this.db.prepare(`
      DELETE FROM businesses WHERE id = ?
    `).bind(id).run();

    return result.success;
  }
}
