import axios, { AxiosInstance } from 'axios';

/**
 * Jina AI Reader API Client
 *
 * Converts HTML/URLs to clean markdown for LLM consumption
 * Free tier: 10M tokens, 200 req/min with API key
 */

export interface JinaConversionResult {
  markdown: string;
  title?: string;
  url?: string;
  tokensUsed?: number;
}

export class JinaAIClient {
  private baseURL: string = 'https://r.jina.ai';
  private apiKey?: string;
  private client: AxiosInstance;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.JINA_API_KEY;

    this.client = axios.create({
      timeout: 60000, // 60 seconds for large documents
      headers: this.apiKey ? {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Retain-Images': 'none', // Don't include images for financial docs
      } : {
        'X-Retain-Images': 'none'
      }
    });
  }

  /**
   * Convert a URL to markdown
   */
  async convertURL(url: string): Promise<JinaConversionResult> {
    try {
      console.log(`[Jina AI] Converting URL to markdown: ${url.substring(0, 100)}...`);

      const jinaURL = `${this.baseURL}/${url}`;

      const response = await this.client.get(jinaURL, {
        headers: {
          'Accept': 'text/plain', // Get plain markdown
        }
      });

      const markdown = response.data;

      // Extract title if present (usually first # heading)
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : undefined;

      console.log(`[Jina AI] ✅ Converted successfully (${markdown.length} chars)`);

      return {
        markdown,
        title,
        url,
        tokensUsed: Math.ceil(markdown.length / 4) // Rough token estimate
      };
    } catch (error: any) {
      console.error('[Jina AI] Conversion failed:', error.message);
      throw new Error(`Jina AI conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert HTML content to markdown (for already-downloaded content)
   */
  async convertHTML(html: string, sourceURL?: string): Promise<JinaConversionResult> {
    try {
      console.log(`[Jina AI] Converting HTML to markdown (${html.length} chars)...`);

      // For HTML content, we need to create a data URL or use a different approach
      // Jina Reader works best with URLs, so we'll use their API endpoint directly

      // Create a temporary URL-like structure
      // Note: This is a workaround - ideally we'd POST HTML directly if Jina supports it
      const response = await this.client.post('https://s.jina.ai/', html, {
        headers: {
          'Content-Type': 'text/html',
          'X-With-Generated-Alt': 'true', // Generate alt text for images
        }
      });

      const markdown = response.data;

      console.log(`[Jina AI] ✅ HTML converted successfully (${markdown.length} chars)`);

      return {
        markdown,
        url: sourceURL,
        tokensUsed: Math.ceil(markdown.length / 4)
      };
    } catch (error: any) {
      console.error('[Jina AI] HTML conversion failed:', error.message);

      // Fallback: simple HTML-to-text conversion
      console.log('[Jina AI] Falling back to simple HTML cleaning...');
      const markdown = this.simpleHTMLToMarkdown(html);

      return {
        markdown,
        url: sourceURL,
        tokensUsed: Math.ceil(markdown.length / 4)
      };
    }
  }

  /**
   * Simple HTML to markdown converter (fallback)
   */
  private simpleHTMLToMarkdown(html: string): string {
    let text = html;

    // Remove script and style tags
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Convert headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

    // Convert lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<\/ol>/gi, '\n');

    // Convert line breaks and paragraphs
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');

    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }

  /**
   * Check if Jina AI is configured
   */
  isConfigured(): boolean {
    // Jina AI works without API key (with rate limits)
    // But having an API key is better
    return true;
  }

  /**
   * Get current configuration status
   */
  getStatus(): { configured: boolean; hasAPIKey: boolean } {
    return {
      configured: true,
      hasAPIKey: !!this.apiKey
    };
  }
}

// Singleton instance
export const jinaClient = new JinaAIClient();
