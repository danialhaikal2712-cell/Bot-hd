const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    const num = "60179424574";
    setTimeout(async () => {
      const code = await sock.requestPairingCode(num);
      console.log("PAIRING CODE:", code);
    }, 3000);
  }

  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'open') console.log("BOT CONNECTED!");
    if (u.connection === 'close') start();
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;

    // Kalau hantar text .menu
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if (text === '.menu') {
      await sock.sendMessage(from, { text: "BOT HD\n\nHantar je VIDEO kat sini, aku akan hantar balik jadi HD!" });
      return;
    }

    // Kalau hantar VIDEO
    if (m.message.videoMessage) {
      await sock.sendMessage(from, { text: "Okay tengah jadikan HD... tunggu jap..." });
      try {
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        const file = `hd_${Date.now()}.mp4`;
        fs.writeFileSync(file, buffer);

        // Hantar balik sebagai HD + sebagai Document supaya tak compress
        await sock.sendMessage(from, {
          video: buffer,
          caption: "Siap! Ni versi HD ✅",
          mimetype: 'video/mp4'
        });

        await sock.sendMessage(from, {
          document: buffer,
          fileName: file,
          mimetype: 'video/mp4',
          caption: "Ni file original HD, download ni kalau nak kualiti penuh"
        });

        fs.unlinkSync(file);
      } catch (e) {
        console.log(e);
        await sock.sendMessage(from, { text: "Gagal proses video. Cuba hantar video bawah 50MB." });
      }
    }
  });
}
start();
