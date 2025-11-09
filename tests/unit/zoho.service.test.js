import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

const postMock = vi.fn();
const getMock = vi.fn();
const createMock = vi.fn(() => ({
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    post: postMock,
    get: getMock,
    create: createMock
  }
}));

const mkdirMock = vi.fn(async () => {});
const writeFileMock = vi.fn(async () => {});

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock
  }
}));

let ZohoCrmService;

describe('ZohoCrmService.getAttachmentsForDeal', () => {
  beforeEach(async () => {
    vi.resetModules();
    postMock.mockReset();
    getMock.mockReset();
    createMock.mockClear();
    mkdirMock.mockClear();
    writeFileMock.mockClear();

    process.env.ZOHO_CLIENT_ID = 'client-id';
    process.env.ZOHO_CLIENT_SECRET = 'client-secret';
    process.env.ZOHO_REFRESH_TOKEN = 'refresh-token';
    process.env.ZOHO_API_DOMAIN = 'https://www.zohoapis.com';

    ({ default: ZohoCrmService } = await import('../../src/services/crm/zoho.service.js'));
  });

  afterEach(() => {
    delete process.env.ZOHO_CLIENT_ID;
    delete process.env.ZOHO_CLIENT_SECRET;
    delete process.env.ZOHO_REFRESH_TOKEN;
    delete process.env.ZOHO_API_DOMAIN;
  });

  it('downloads attachments and returns local file paths', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        access_token: 'access-token',
        expires_in: 3600
      }
    });

    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'att-1',
              File_Name: 'statement1.pdf',
              $download_url: '/crm/v2/Deals/deal-123/Attachments/att-1'
            },
            {
              id: 'att-2',
              File_Name: 'statement2.pdf'
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        data: Buffer.from('file-1')
      })
      .mockResolvedValueOnce({
        data: Buffer.from('file-2')
      });

    const service = new ZohoCrmService({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token'
    });

    const files = await service.getAttachmentsForDeal('deal-123');

    expect(postMock).toHaveBeenCalledWith(
      'https://accounts.zoho.com/oauth/v2/token',
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    );

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      'https://www.zohoapis.com/crm/v2/Deals/deal-123/Attachments',
      expect.objectContaining({
        headers: {
          Authorization: 'Zoho-oauthtoken access-token'
        }
      })
    );

    expect(getMock).toHaveBeenNthCalledWith(
      2,
      'https://www.zohoapis.com/crm/v2/Deals/deal-123/Attachments/att-1',
      expect.objectContaining({
        headers: {
          Authorization: 'Zoho-oauthtoken access-token'
        },
        responseType: 'arraybuffer'
      })
    );

    expect(getMock).toHaveBeenNthCalledWith(
      3,
      'https://www.zohoapis.com/crm/v2/Deals/deal-123/Attachments/att-2',
      expect.objectContaining({
        headers: {
          Authorization: 'Zoho-oauthtoken access-token'
        },
        responseType: 'arraybuffer'
      })
    );

    expect(mkdirMock).toHaveBeenCalledWith(path.join(process.cwd(), 'tmp', 'uploads'), { recursive: true });
    expect(writeFileMock).toHaveBeenCalledTimes(2);
    expect(files).toHaveLength(2);
    expect(files[0]).toEqual(expect.objectContaining({
      id: 'att-1',
      fileName: 'statement1.pdf',
      filePath: expect.stringContaining(path.join('tmp', 'uploads', 'att-1'))
    }));
  });

  it('returns empty array when no attachments found', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        access_token: 'access-token',
        expires_in: 3600
      }
    });

    getMock.mockResolvedValueOnce({ data: { data: [] } });

    const service = new ZohoCrmService({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token'
    });

    const files = await service.getAttachmentsForDeal('deal-empty');

    expect(files).toEqual([]);
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
