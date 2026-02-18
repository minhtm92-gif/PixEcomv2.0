import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly cdnBase: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('R2_ENDPOINT', '');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY', '');

    this.bucket = config.get<string>('R2_BUCKET_NAME', 'pixecom-assets');
    this.cdnBase = config
      .get<string>('CDN_BASE_URL', '')
      .replace(/\/$/, ''); // strip trailing slash

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /**
   * Generates a presigned PUT URL for direct client-side upload to R2.
   *
   * @param key         Object key in the bucket (e.g. "sellers/abc123/video.mp4")
   * @param contentType MIME type declared by the client
   * @param expiresIn   URL expiry in seconds (default: 300 = 5 min)
   *
   * @returns
   *   uploadUrl  — presigned PUT URL the client should PUT the file to
   *   publicUrl  — CDN URL where the asset will be readable after upload
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    const publicUrl = `${this.cdnBase}/${key}`;

    this.logger.debug(`Generated signed upload URL for key=${key}`);

    return { uploadUrl, publicUrl };
  }

  /**
   * Builds a deterministic storage key for a seller asset.
   * Format: sellers/{sellerId}/{filename}
   */
  buildKey(sellerId: string, filename: string): string {
    // Sanitise filename: strip directory traversal, keep only safe chars
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return `sellers/${sellerId}/${Date.now()}-${safe}`;
  }

  /**
   * Builds a key for platform/system assets.
   * Format: platform/{filename}
   */
  buildPlatformKey(filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return `platform/${Date.now()}-${safe}`;
  }
}
