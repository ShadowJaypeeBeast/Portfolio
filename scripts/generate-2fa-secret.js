// Run this once to set up two-factor login: `node scripts/generate-2fa-secret.js`
//
// It generates a new TOTP secret, prints a QR code you can scan directly
// from your terminal (works fine over SSH — no need to download a file),
// and tells you exactly what to add to your .env file. 2FA stays OFF until
// you actually add ADMIN_TOTP_SECRET to .env and restart the server.

const { authenticator } = require('otplib');
const qrcode = require('qrcode-terminal');

const label = process.argv[2] || 'admin';
const issuer = process.argv[3] || 'Portfolio Admin';

const secret = authenticator.generateSecret();
const otpauthUrl = authenticator.keyuri(label, issuer, secret);

console.log('\n=== Two-factor login setup ===\n');
console.log('Scan this QR code with Google Authenticator, Authy, 1Password, or any TOTP app:\n');

qrcode.generate(otpauthUrl, { small: true }, (qr) => {
  console.log(qr);
  console.log('Can\'t scan it? Enter this secret manually in your authenticator app instead:');
  console.log(`  ${secret}\n`);
  console.log('Then add this line to your .env file and restart the server:\n');
  console.log(`  ADMIN_TOTP_SECRET=${secret}\n`);
  console.log('Until you do that and restart, 2FA stays off and login works with just your');
  console.log('username and password, same as before.\n');
});
