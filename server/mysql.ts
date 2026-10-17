import mysql from 'mysql2/promise';
import { User, Session, ContentItem, BrandVoice } from './db';

// Environment variables for MySQL connection
const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || '';

let pool: mysql.Pool | null = null;
let isInitialized = false;

export function isMySQLConfigured(): boolean {
  return Boolean(DB_HOST && DB_USER && DB_NAME);
}

export function getMySQLPool(): mysql.Pool | null {
  if (!isMySQLConfigured()) {
    return null;
  }

  if (!pool) {
    try {
      const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes((DB_HOST || '').toLowerCase());
      const requireSSL = process.env.DB_SSL === 'false' ? false : (process.env.DB_SSL === 'true' || !isLocalHost);

      const sslConfig = requireSSL ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true
      } : undefined;

      pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        ssl: sslConfig
      });
      console.log(`[MySQL] Connection pool initialized with SSL=${Boolean(requireSSL)} for ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    } catch (err) {
      console.error('[MySQL] Error creating pool:', err);
      pool = null;
    }
  }

  return pool;
}

export async function initializeMySQLTables(): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  if (isInitialized) return true;

  try {
    const connection = await p.getConnection();
    try {
      // Create users table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          google_id VARCHAR(128) UNIQUE NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) DEFAULT '',
          avatar TEXT NULL,
          role ENUM('user', 'admin') DEFAULT 'user',
          tier ENUM('free', 'pro', 'agency') DEFAULT 'free',
          credits_used INT DEFAULT 0,
          credits_limit INT DEFAULT 10,
          creator_name VARCHAR(255) NULL,
          preferences JSON NULL,
          disabled BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_email (email),
          INDEX idx_user_google_id (google_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Create sessions table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_session_user (user_id),
          INDEX idx_session_expires (expires_at),
          CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Create content table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS content (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          title VARCHAR(500) NOT NULL,
          type VARCHAR(50) DEFAULT 'general',
          platform VARCHAR(50) DEFAULT 'instagram',
          language VARCHAR(50) DEFAULT 'english',
          tone VARCHAR(100) DEFAULT 'Conversational',
          topic TEXT NOT NULL,
          content LONGTEXT NOT NULL,
          structured_data JSON NULL,
          meta JSON NULL,
          tags JSON NULL,
          is_favorite BOOLEAN DEFAULT FALSE,
          folder_id VARCHAR(64) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_content_user (user_id),
          INDEX idx_content_type (type),
          INDEX idx_content_platform (platform),
          INDEX idx_content_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Create brand_voice table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS brand_voice (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL UNIQUE,
          brand_name VARCHAR(255) NOT NULL,
          business_description TEXT NULL,
          target_audience TEXT NULL,
          preferred_tone VARCHAR(100) NULL,
          words_to_use TEXT NULL,
          words_to_avoid TEXT NULL,
          brand_personality TEXT NULL,
          cta_style TEXT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_bv_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Create usage_logs table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS usage_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          feature VARCHAR(100) NOT NULL,
          tokens_used INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_usage_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      isInitialized = true;
      console.log('[MySQL] Tables verified/initialized successfully (users, sessions, content, brand_voice, usage_logs).');
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('[MySQL] Table initialization error:', err);
    return false;
  }
}

// Convert MySQL row to User object
function rowToUser(row: any): User {
  let parsedPreferences: any = undefined;
  if (row.preferences) {
    try {
      parsedPreferences = typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences;
    } catch {
      parsedPreferences = undefined;
    }
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash || '',
    google_id: row.google_id || undefined,
    avatar: row.avatar || undefined,
    role: (row.role as 'user' | 'admin') || 'user',
    tier: (row.tier as 'free' | 'pro' | 'agency') || 'free',
    credits_used: Number(row.credits_used) || 0,
    credits_limit: Number(row.credits_limit) || 10,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    disabled: Boolean(row.disabled),
    creator_name: row.creator_name || undefined,
    preferences: parsedPreferences
  };
}

export async function findUserByGoogleIdMySQL(googleId: string): Promise<User | null> {
  const p = getMySQLPool();
  if (!p) return null;
  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM users WHERE google_id = ? LIMIT 1',
      [googleId]
    );
    if (rows.length === 0) return null;
    return rowToUser(rows[0]);
  } catch (err) {
    console.error('[MySQL] findUserByGoogleId error:', err);
    return null;
  }
}

export async function findUserByEmailMySQL(email: string): Promise<User | null> {
  const p = getMySQLPool();
  if (!p) return null;
  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );
    if (rows.length === 0) return null;
    return rowToUser(rows[0]);
  } catch (err) {
    console.error('[MySQL] findUserByEmail error:', err);
    return null;
  }
}

export async function findUserByIdMySQL(userId: string): Promise<User | null> {
  const p = getMySQLPool();
  if (!p) return null;
  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (rows.length === 0) return null;
    return rowToUser(rows[0]);
  } catch (err) {
    console.error('[MySQL] findUserById error:', err);
    return null;
  }
}

export async function createUserMySQL(userData: Partial<User> & { email: string; name: string }): Promise<User | null> {
  const p = getMySQLPool();
  if (!p) return null;

  const id = userData.id || `u_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const email = userData.email.toLowerCase().trim();
  const name = userData.name.trim();
  const googleId = userData.google_id || null;
  const avatar = userData.avatar || null;
  const passwordHash = userData.passwordHash || '';
  const role = userData.role || (email.includes('admin') ? 'admin' : 'user');
  const tier = userData.tier || 'free';
  const creditsUsed = userData.credits_used || 0;
  const creditsLimit = userData.credits_limit || 10;
  const preferences = userData.preferences ? JSON.stringify(userData.preferences) : null;

  try {
    await p.execute(
      `INSERT INTO users 
        (id, google_id, name, email, password_hash, avatar, role, tier, credits_used, credits_limit, preferences) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, googleId, name, email, passwordHash, avatar, role, tier, creditsUsed, creditsLimit, preferences]
    );

    return findUserByIdMySQL(id);
  } catch (err) {
    console.error('[MySQL] createUser error:', err);
    return null;
  }
}

export async function updateUserMySQL(userId: string, updates: Partial<User>): Promise<User | null> {
  const p = getMySQLPool();
  if (!p) return null;

  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    setClauses.push('email = ?');
    values.push(updates.email.toLowerCase().trim());
  }
  if (updates.google_id !== undefined) {
    setClauses.push('google_id = ?');
    values.push(updates.google_id);
  }
  if (updates.avatar !== undefined) {
    setClauses.push('avatar = ?');
    values.push(updates.avatar);
  }
  if (updates.role !== undefined) {
    setClauses.push('role = ?');
    values.push(updates.role);
  }
  if (updates.tier !== undefined) {
    setClauses.push('tier = ?');
    values.push(updates.tier);
  }
  if (updates.credits_used !== undefined) {
    setClauses.push('credits_used = ?');
    values.push(updates.credits_used);
  }
  if (updates.credits_limit !== undefined) {
    setClauses.push('credits_limit = ?');
    values.push(updates.credits_limit);
  }
  if (updates.disabled !== undefined) {
    setClauses.push('disabled = ?');
    values.push(updates.disabled ? 1 : 0);
  }
  if (updates.creator_name !== undefined) {
    setClauses.push('creator_name = ?');
    values.push(updates.creator_name);
  }
  if (updates.preferences !== undefined) {
    setClauses.push('preferences = ?');
    values.push(JSON.stringify(updates.preferences));
  }

  if (setClauses.length === 0) {
    return findUserByIdMySQL(userId);
  }

  values.push(userId);

  try {
    await p.execute(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );
    return findUserByIdMySQL(userId);
  } catch (err) {
    console.error('[MySQL] updateUser error:', err);
    return null;
  }
}

export async function createSessionMySQL(userId: string, durationMs = 7 * 24 * 60 * 60 * 1000): Promise<string | null> {
  const p = getMySQLPool();
  if (!p) return null;

  const token = `s_${Date.now()}_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
  const expiresAt = new Date(Date.now() + durationMs).toISOString().slice(0, 19).replace('T', ' ');

  try {
    await p.execute(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      [token, userId, expiresAt]
    );
    return token;
  } catch (err) {
    console.error('[MySQL] createSession error:', err);
    return null;
  }
}

export async function findSessionMySQL(token: string): Promise<Session | null> {
  const p = getMySQLPool();
  if (!p) return null;

  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM sessions WHERE id = ? AND expires_at > NOW() LIMIT 1',
      [token]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString()
    };
  } catch (err) {
    console.error('[MySQL] findSession error:', err);
    return null;
  }
}

export async function deleteSessionMySQL(token: string): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  try {
    const [result]: any = await p.execute(
      'DELETE FROM sessions WHERE id = ?',
      [token]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error('[MySQL] deleteSession error:', err);
    return false;
  }
}

// Convert MySQL row to ContentItem
function rowToContent(row: any): ContentItem {
  const parseJson = (val: any) => {
    if (!val) return undefined;
    try {
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch {
      return undefined;
    }
  };

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    type: row.type || 'general',
    platform: row.platform || 'instagram',
    language: row.language || 'english',
    tone: row.tone || 'Conversational',
    topic: row.topic || '',
    content: row.content || '',
    structured_data: parseJson(row.structured_data),
    meta: parseJson(row.meta),
    tags: parseJson(row.tags),
    is_favorite: Boolean(row.is_favorite),
    folder_id: row.folder_id || undefined,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function saveContentMySQL(item: ContentItem): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  try {
    await p.execute(
      `INSERT INTO content 
        (id, user_id, title, type, platform, language, tone, topic, content, structured_data, meta, tags, is_favorite, folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        type = VALUES(type),
        platform = VALUES(platform),
        language = VALUES(language),
        tone = VALUES(tone),
        topic = VALUES(topic),
        content = VALUES(content),
        structured_data = VALUES(structured_data),
        meta = VALUES(meta),
        tags = VALUES(tags),
        is_favorite = VALUES(is_favorite),
        folder_id = VALUES(folder_id)`,
      [
        item.id,
        item.user_id,
        item.title,
        item.type || 'general',
        item.platform || 'instagram',
        item.language || 'english',
        item.tone || 'Conversational',
        item.topic || item.title,
        item.content,
        item.structured_data ? JSON.stringify(item.structured_data) : null,
        item.meta ? JSON.stringify(item.meta) : null,
        item.tags ? JSON.stringify(item.tags) : null,
        item.is_favorite ? 1 : 0,
        item.folder_id || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[MySQL] saveContent error:', err);
    return false;
  }
}

export async function getContentByUserMySQL(userId: string): Promise<ContentItem[]> {
  const p = getMySQLPool();
  if (!p) return [];

  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM content WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(rowToContent);
  } catch (err) {
    console.error('[MySQL] getContentByUser error:', err);
    return [];
  }
}

export async function getContentByIdMySQL(id: string): Promise<ContentItem | null> {
  const p = getMySQLPool();
  if (!p) return null;

  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM content WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return rowToContent(rows[0]);
  } catch (err) {
    console.error('[MySQL] getContentById error:', err);
    return null;
  }
}

export async function updateContentMySQL(id: string, updates: Partial<ContentItem>): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    values.push(updates.content);
  }
  if (updates.type !== undefined) {
    setClauses.push('type = ?');
    values.push(updates.type);
  }
  if (updates.platform !== undefined) {
    setClauses.push('platform = ?');
    values.push(updates.platform);
  }
  if (updates.language !== undefined) {
    setClauses.push('language = ?');
    values.push(updates.language);
  }
  if (updates.tone !== undefined) {
    setClauses.push('tone = ?');
    values.push(updates.tone);
  }
  if (updates.topic !== undefined) {
    setClauses.push('topic = ?');
    values.push(updates.topic);
  }
  if (updates.structured_data !== undefined) {
    setClauses.push('structured_data = ?');
    values.push(updates.structured_data ? JSON.stringify(updates.structured_data) : null);
  }
  if (updates.meta !== undefined) {
    setClauses.push('meta = ?');
    values.push(updates.meta ? JSON.stringify(updates.meta) : null);
  }
  if (updates.is_favorite !== undefined) {
    setClauses.push('is_favorite = ?');
    values.push(updates.is_favorite ? 1 : 0);
  }
  if (updates.folder_id !== undefined) {
    setClauses.push('folder_id = ?');
    values.push(updates.folder_id || null);
  }

  if (setClauses.length === 0) return true;

  values.push(id);

  try {
    const [result]: any = await p.execute(
      `UPDATE content SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error('[MySQL] updateContent error:', err);
    return false;
  }
}

export async function deleteContentMySQL(id: string): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  try {
    const [result]: any = await p.execute(
      'DELETE FROM content WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error('[MySQL] deleteContent error:', err);
    return false;
  }
}

// Convert MySQL row to BrandVoice
function rowToBrandVoice(row: any): BrandVoice {
  return {
    id: row.id,
    user_id: row.user_id,
    brand_name: row.brand_name,
    business_description: row.business_description || '',
    target_audience: row.target_audience || '',
    preferred_tone: row.preferred_tone || '',
    words_to_use: row.words_to_use || '',
    words_to_avoid: row.words_to_avoid || '',
    brand_personality: row.brand_personality || '',
    cta_style: row.cta_style || '',
    is_active: Boolean(row.is_active),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function saveBrandVoiceMySQL(bv: BrandVoice): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  try {
    await p.execute(
      `INSERT INTO brand_voice
        (id, user_id, brand_name, business_description, target_audience, preferred_tone, words_to_use, words_to_avoid, brand_personality, cta_style, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        brand_name = VALUES(brand_name),
        business_description = VALUES(business_description),
        target_audience = VALUES(target_audience),
        preferred_tone = VALUES(preferred_tone),
        words_to_use = VALUES(words_to_use),
        words_to_avoid = VALUES(words_to_avoid),
        brand_personality = VALUES(brand_personality),
        cta_style = VALUES(cta_style),
        is_active = VALUES(is_active)`,
      [
        bv.id,
        bv.user_id,
        bv.brand_name,
        bv.business_description || '',
        bv.target_audience || '',
        bv.preferred_tone || '',
        bv.words_to_use || '',
        bv.words_to_avoid || '',
        bv.brand_personality || '',
        bv.cta_style || '',
        bv.is_active ? 1 : 0
      ]
    );
    return true;
  } catch (err) {
    console.error('[MySQL] saveBrandVoice error:', err);
    return false;
  }
}

export async function getBrandVoiceByUserMySQL(userId: string): Promise<BrandVoice | null> {
  const p = getMySQLPool();
  if (!p) return null;

  try {
    const [rows]: [any[], any] = await p.execute(
      'SELECT * FROM brand_voice WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (rows.length === 0) return null;
    return rowToBrandVoice(rows[0]);
  } catch (err) {
    console.error('[MySQL] getBrandVoiceByUser error:', err);
    return null;
  }
}

export async function logUsageMySQL(userId: string, feature: string, tokens = 0): Promise<boolean> {
  const p = getMySQLPool();
  if (!p) return false;

  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  try {
    await p.execute(
      'INSERT INTO usage_logs (id, user_id, feature, tokens_used) VALUES (?, ?, ?, ?)',
      [id, userId, feature, tokens]
    );
    return true;
  } catch (err) {
    console.error('[MySQL] logUsage error:', err);
    return false;
  }
}
