import { Injectable } from '@nestjs/common';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: AppConfigService) {
    const { endpoint, accessKey, secretKey, bucket } = this.config.minio;
    // ถ้า .env ใส่แค่ host:port ให้เติมโปรโตคอลให้เอง
    const url = endpoint.startsWith('http') ? endpoint : `http://${endpoint}`;
    this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: url,
      forcePathStyle: true, // สำคัญสำหรับ MinIO
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    this.bucket = bucket;
  }

  async checkBucket(): Promise<boolean> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
