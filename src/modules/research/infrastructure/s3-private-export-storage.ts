import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PrivateExportStorage } from "../application/ports/research-report-repository.ts";
import { isApprovedPrivateStorageUrl } from "../domain/private-url.ts";

export class S3PrivateExportStorage implements PrivateExportStorage {
  private readonly client: S3Client;
  private constructor(private readonly bucket: string, config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; allowTestLoopbackHttp: boolean }) {
    const endpoint = new URL(config.endpoint);
    if (!isApprovedPrivateStorageUrl(endpoint.toString(), config.allowTestLoopbackHttp)) {
      throw new Error("S3_ENDPOINT_MUST_USE_HTTPS");
    }
    this.client = new S3Client({ endpoint: endpoint.toString(), region: config.region, forcePathStyle: true, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  }

  static fromEnvironment(env: Record<string, string | undefined> = process.env) {
    const bucket = env.S3_BUCKET?.trim(); const endpoint = env.S3_ENDPOINT?.trim(); const region = env.S3_REGION?.trim();
    const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim(); const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
    if (!bucket || !endpoint || !region || !accessKeyId || !secretAccessKey) throw new Error("S3_EXPORT_CONFIGURATION_MISSING");
    return new S3PrivateExportStorage(bucket, {
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      allowTestLoopbackHttp: env.APP_ENV === "test",
    });
  }

  async putCsv(objectKey: string, body: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: body, ContentType: "text/csv; charset=utf-8", CacheControl: "private, no-store", ServerSideEncryption: "AES256" }));
  }
  createDownloadUrl(objectKey: string, expiresInSeconds: number) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: objectKey, ResponseCacheControl: "private, no-store", ResponseContentDisposition: 'attachment; filename="research.csv"' }), { expiresIn: expiresInSeconds });
  }
}
