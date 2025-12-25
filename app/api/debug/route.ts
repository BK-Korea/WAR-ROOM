import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // 보안: 프로덕션에서는 API 키 전체를 노출하지 않음
  const apiKey = process.env.GLM_API_KEY;
  const maskedKey = apiKey
    ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`
    : 'NOT SET';

  return NextResponse.json({
    environment: {
      GLM_API_KEY: maskedKey,
      GLM_API_BASE_URL: process.env.GLM_API_BASE_URL || 'NOT SET',
      GLM_MODEL: process.env.GLM_MODEL || 'NOT SET (using default: glm-4-plus)',
      GLM_MOCK_MODE: process.env.GLM_MOCK_MODE || 'NOT SET (default: false)',
    },
    status: {
      apiKeyConfigured: !!process.env.GLM_API_KEY,
      mockMode: process.env.GLM_MOCK_MODE === 'true',
      baseUrl: process.env.GLM_API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    },
    nodeEnv: process.env.NODE_ENV,
  });
}
