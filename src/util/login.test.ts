import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../testcase/test', () => ({
  execDrushInTestSite: vi.fn(),
}));

import { execDrushInTestSite } from '../testcase/test';
import { login } from './login';

const mockedDrush = vi.mocked(execDrushInTestSite);

interface FakePage {
  goto: ReturnType<typeof vi.fn>;
  context: () => { cookies: ReturnType<typeof vi.fn> };
}

function fakePage(cookies: { name: string }[] = [{ name: 'SSESSabc' }]): FakePage {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    context: () => ({ cookies: vi.fn().mockResolvedValue(cookies) }),
  };
}

describe('login', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('defaults to the admin username', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/1/abc\n',
      stderr: '',
    } as never);
    await login(fakePage() as never);
    expect(mockedDrush).toHaveBeenCalledWith('user:login --name=admin');
  });

  it('passes a string argument as --name', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/2/xyz',
      stderr: '',
    } as never);
    await login(fakePage() as never, 'editor');
    expect(mockedDrush).toHaveBeenCalledWith('user:login --name=editor');
  });

  it('passes a number argument as --uid', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/42/xyz',
      stderr: '',
    } as never);
    await login(fakePage() as never, 42);
    expect(mockedDrush).toHaveBeenCalledWith('user:login --uid=42');
  });

  it('shell-quotes usernames with metacharacters', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/1/abc',
      stderr: '',
    } as never);
    await login(fakePage() as never, 'evil; rm -rf /');
    const command = mockedDrush.mock.calls[0][0] as string;
    expect(command).toContain("--name='evil; rm -rf /'");
  });

  it('navigates to the path + search from the login URL, not the absolute URL', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/1/abc/def?destination=/node/5',
      stderr: '',
    } as never);
    const page = fakePage();
    await login(page as never);
    expect(page.goto).toHaveBeenCalledWith(
      '/user/reset/1/abc/def?destination=/node/5',
    );
  });

  it('accepts SESS (HTTP) session cookies as well as SSESS (HTTPS)', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/1/abc',
      stderr: '',
    } as never);
    await expect(
      login(fakePage([{ name: 'SESSabc' }]) as never),
    ).resolves.toBeUndefined();
  });

  it('throws when no Drupal session cookie is present after the redirect', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: 'http://example.test/user/reset/1/abc',
      stderr: '',
    } as never);
    await expect(login(fakePage([]) as never)).rejects.toThrow(
      /no Drupal session cookie/,
    );
  });
});
