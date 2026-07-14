const { isPrivateOrReservedIp } = require('../controllers/attendanceUploadController');

// Documents the SSRF fix: the "import attendance from URL" feature must
// refuse to fetch URLs that resolve to internal/private/loopback addresses.
describe('SSRF guard — isPrivateOrReservedIp', () => {
  test.each([
    ['127.0.0.1', 'loopback'],
    ['169.254.169.254', 'cloud metadata / link-local'],
    ['10.0.0.5', '10.0.0.0/8 private'],
    ['172.16.0.1', '172.16.0.0/12 lower bound'],
    ['172.31.255.255', '172.16.0.0/12 upper bound'],
    ['192.168.1.1', '192.168.0.0/16 private'],
    ['0.0.0.0', '0.0.0.0/8'],
    ['::1', 'IPv6 loopback'],
    ['fe80::1', 'IPv6 link-local'],
  ])('blocks %s (%s)', (ip) => {
    expect(isPrivateOrReservedIp(ip)).toBe(true);
  });

  test.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['172.32.0.1'], // just outside the 172.16-31 private range
    ['142.250.72.14'],
  ])('allows public address %s', (ip) => {
    expect(isPrivateOrReservedIp(ip)).toBe(false);
  });
});
