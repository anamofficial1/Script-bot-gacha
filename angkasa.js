/*

   BASE INI FREE NO SALE
   JIKA MENEMUKAN YANG MENJUAL BELIKAN
   HARAP LAPORKAN KE 
   DEVELOPER : https://t.me/angkasanybobo
   CHANNEL : https://t.me/angkasalagibobo
   ROOMPUBLIC : https://t.me/roomangkasa
   KEBUTUHAN HOSTING : https://angkasalagijajan.vercel.app

*/

const TelegramBot = require('node-telegram-bot-api');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs-extra');
const yts = require("yt-search");
const axios = require('axios');
const sharp = require("sharp");
const chalk = require("chalk");
const AdmZip = require("adm-zip");
const { JSDOM } = require("jsdom");
const os = require('os');
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TOKEN, OWNER, APIKEY, CHANNEL_ID, CHANNEL_LINK, NAMA_BOT, USERNAME_BOT, VERSION, GETCHANNELID_USERNAME } = require('./config');
const moment = require('moment-timezone');
const bot = new TelegramBot(TOKEN, { polling: true });

const mediaGroups = {};
const groupsFile = path.join(__dirname, "database/jasher.json");
const dbAntiShare = path.join(__dirname, "./database/antishare.json");
const dbAntiLink = path.join(__dirname, './database/antilink.json');
const adminFile = path.join(__dirname, "./database/admin.json");
const filterFile = './database/filters.json';
const dbFile = "./database/users.json";
const GACHA_FOLDER = path.join(__dirname, 'gacha');
const DATA_FOLDER = path.join(__dirname, 'database');
const ITEMS_FILE = path.join(DATA_FOLDER, 'items.json');
const USERS_FILE = path.join(DATA_FOLDER, 'users.json');
const CODES_FILE = path.join(DATA_FOLDER, 'codes.json');
const db = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
const admins = JSON.parse(fs.readFileSync('./database/admin.json', 'utf8')).admins;
fs.ensureDirSync(GACHA_FOLDER);
fs.ensureDirSync(DATA_FOLDER);

let khodamList = [];
let chatSessions = {};
let filters = {};

let items = fs.existsSync(ITEMS_FILE) ? JSON.parse(fs.readFileSync(ITEMS_FILE)) : [];
let users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : {};

function saveItems(){ fs.writeJsonSync(ITEMS_FILE, items, { spaces: 2 }); }
function saveUsers(){ fs.writeJsonSync(USERS_FILE, users, { spaces: 2 }); }
function saveCodes(){ fs.writeJsonSync(CODES_FILE, codes, { spaces: 2 }); }

const isMaintenance = false;
const ALLOWED_EXT = ['.js', '.zip', '.txt', '.html', '.htm', '.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.js', '.json', '.md', '.py', '.html', '.css', '.env', '.csv', '.yml', '.yaml', '.sh', '.sql'];
const DAILY_LIMIT = 3;
const EXPIRATION_MINUTES = 15;
const GACHA_COOLDOWN = 10 * 1000;

//===================== FUNCTION =====================

async function getChannelId() {
  try {
    const chat = await bot.getChat(`${GETCHANNELID_USERNAME}`); 
    console.log('ID Channel:', chat.id);
  } catch (err) {
    console.error('Gagal mendapatkan ID channel:', err.message);
  }
}

function maintenanceCheck(bot, msgOrQuery) {
  const chatId = msgOrQuery.chat?.id || msgOrQuery.message?.chat?.id;
  const userId = msgOrQuery.from?.id;

  if (isMaintenance && userId !== OWNER) {
    bot.sendMessage(chatId, `<blockquote>🚧 Bot sedang dalam mode maintenance.\nSilakan coba lagi nanti.</blockquote>`, {
      parse_mode: "HTML",
    });
    return true;
  }
  return false;
}

function escapeHtml(text) {
  if (typeof text !== "string") return text ?? "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeFilename(name) {
  if (typeof name !== "string") return "file";
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").slice(0, 100);
}

function extractUrl(text) {
  if (!text) return null;
  const urlMatch = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w\-]+|youtu\.be\/[\w\-]+)/i);
  return urlMatch ? urlMatch[0] : null;
}

async function uploadToCatbox(fileBuffer, filename) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", new Blob([fileBuffer]), filename);

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  if (!res.ok || text.startsWith("ERROR")) {
    throw new Error("Upload gagal: " + text);
  }
  return text.trim();
}

async function tiktok(url) {
  try {
    const encodedParams = new URLSearchParams();
    encodedParams.set("url", url);
    encodedParams.set("hd", "1");

    const response = await axios.post("https://tikwm.com/api/", encodedParams, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": "current_language=en",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      },
    });

    if (!response.data || !response.data.data) {
      throw new Error("Gagal mendapatkan data TikTok");
    }

    const videos = response.data.data;
    return {
      title: videos.title,
      cover: videos.cover,
      origin_cover: videos.origin_cover,
      no_watermark: videos.play,
      watermark: videos.wmplay,
      music: videos.music,
    };
  } catch (error) {
    throw error;
  }
}

function sanitizeFilename(name){
  return path.basename(name);
}

function isSafeFile(relPath) {
  try {
    const fullPath = path.join(GACHA_FOLDER, relPath);
    const stat = fs.statSync(fullPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function loadItemsFromFolder(){
  const files = fs.readdirSync(GACHA_FOLDER);
  const valid = files.filter(f => isSafeFile(f)).map(f => ({ filename: f }));
  items = valid;
  saveItems();
  return items;
}

function getRandomInt(max){ return Math.floor(Math.random() * max); }

function resetWeeklyIfNeeded(userData) {
  const now = new Date();
  const lastReset = userData.lastReset ? new Date(userData.lastReset) : null;

  if (!lastReset || (now - lastReset) >= 7 * 24 * 60 * 60 * 1000) {
    userData.count = 0;
    userData.lastReset = now.toISOString();
  }
}

function getNextResetDate(lastReset) {
  if (!lastReset) return "Belum Pernah Gacha";
  const resetDate = new Date(lastReset);
  resetDate.setDate(resetDate.getDate() + 7);
  return resetDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta"
  });
}

function ensureUserRecord(userId){
  if(!users[userId]) users[userId] = { history: [], count: 0, lastReset: null, totalWins: 0 };
  resetWeeklyIfNeeded(users[userId]);
  return users[userId];
}

function encryptJS(code) {
  const watermark = `// 🔒 Encrypted by Angkasa\n`;
  const withWM = watermark + code;

  const obfuscated = JavaScriptObfuscator.obfuscate(withWM, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 1,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: true,
    selfDefending: true,
    splitStrings: true,
    splitStringsChunkLength: 4,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 1,
    stringArrayRotate: true,
    transformObjectKeys: true,
    unicodeEscapeSequence: true
  });

  return obfuscated.getObfuscatedCode();
}

const SYSTEM_HEADER = 
`// 𝗕𝘆𝗽𝗮𝘀𝘀 𝗯𝘆 𝗮𝗻𝗴𝗸𝗮𝘀𝗮 𝗻𝗶𝗵 𝘀𝗰 𝗸𝘂𝗿𝗲𝗻𝗴 𝗸𝗲𝗮𝗺𝗮𝗻𝗮𝗻 𝗻𝘆𝗮 𝗽𝗲𝗿𝗰𝘂𝗺𝗮 𝗱𝗶 𝗲𝗻𝗰
const PLAxios = require("axios");
const PLChalk = require("chalk");
function requestInterceptor(cfg) {
  const urlTarget = cfg.url;
  const domainGithub = [
    "github.com",
    "raw.githubusercontent.com",
    "api.github.com",
  ];
  const isGitUrl = domainGithub.some((domain) => urlTarget.includes(domain));
  if (isGitUrl) {
    console.warn(
      PLChalk.blue("[ 𝗦𝗬𝗦𝗧𝗘𝗠 𝗗𝗜 𝗔𝗠𝗕𝗜𝗟 𝗔𝗟𝗜𝗛 𝗢𝗟𝗘𝗛 𝗔𝗡𝗚𝗞𝗔𝗦𝗔 ]") +
        PLChalk.gray(" [ 𝗔𝗠𝗣𝗔𝗦 𝗦𝗖 𝗡𝗬𝗔 ] ➜  " + urlTarget)
    );
  }
  return cfg;
}
function errorInterceptor(error) {
  const nihUrlKlwError = error?.config?.url || "URL tidak diketahui";
  console.error(
    PLChalk.yellow("[ 𝗕𝗬𝗣𝗔𝗦𝗦 𝗕𝗬 𝗔𝗡𝗚𝗞𝗔𝗦𝗔 ] ➜  Failed To Access: " + nihUrlKlwError)
  );
  return Promise.reject(error);
}

PLAxios.interceptors.request.use(requestInterceptor, errorInterceptor);

// Ini Batas Untuk Interceptor Axios nya

const originalExit = process.exit;
process.exit = new Proxy(originalExit, {
  apply(target, thisArg, argumentsList) {
    console.log("[ 👑 ] 𝗦𝗖𝗥𝗜𝗣𝗧 𝗗𝗜 𝗔𝗠𝗕𝗜𝗟 𝗔𝗟𝗜𝗛 𝗢𝗟𝗘𝗛 𝗔𝗡𝗚𝗞𝗔𝗦𝗔");
  },
});

const originalKill = process.kill;
process.kill = function (pid, signal) {
  if (pid === process.pid) {
    console.log("[ 👑 ] 𝗦𝗖𝗥𝗜𝗣𝗧 𝗗𝗜 𝗔𝗠𝗕𝗜𝗟 𝗔𝗟𝗜𝗛 𝗢𝗟𝗘𝗛 𝗔𝗡𝗚𝗞𝗔𝗦𝗔");
  } else {
    return originalKill(pid, signal);
  }
};

["SIGINT", "SIGTERM", "SIGHUP"].forEach((signal) => {
  process.on(signal, () => {
    console.log("[ 👑 ] Sinyal " + signal + " terdeteksi dan diabaikan");
  });
});

process.on("uncaughtException", (error) => {
  console.log("[ 👑 ] uncaughtException: " + error);
});
process.on("unhandledRejection", (reason) => {
  console.log("[ 👑 ] unhandledRejection: " + reason);
});
`;

function extAllowed(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

async function loadCekKhodam() {
  try {
    const url = "https://raw.githubusercontent.com/angkasanotdev/DatabaseRaw/refs/heads/main/cekkhodam.json";
    const res = await axios.get(url);
    cekKhodam = res.data;
    console.log("✅ Berhasil load List Cek Khodam:", cekKhodam.length, "item");
  } catch (err) {
    console.error("❌ Gagal load List Cek Khodam:", err.message);
  }
}

const getUptime = () => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
};

const stickerDir = path.join(__dirname, "stickers");
if (!fs.existsSync(stickerDir)) fs.mkdirSync(stickerDir);

loadCekKhodam();

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}    

function komentarTampan(nilai) {
  if (nilai >= 100) return "💎 Ganteng dewa, mustahil diciptakan ulang.";
  if (nilai >= 94) return "🔥 Ganteng gila! Mirip artis Korea!";
  if (nilai >= 90) return "😎 Bintang iklan skincare!";
  if (nilai >= 83) return "✨ Wajahmu memantulkan sinar kebahagiaan.";
  if (nilai >= 78) return "🧼 Bersih dan rapih, cocok jadi influencer!";
  if (nilai >= 73) return "🆒 Ganteng natural, no filter!";
  if (nilai >= 68) return "😉 Banyak yang naksir nih kayaknya.";
  if (nilai >= 54) return "🙂 Lumayan sih... asal jangan senyum terus.";
  if (nilai >= 50) return "😐 Gantengnya malu-malu.";
  if (nilai >= 45) return "😬 Masih bisa lah asal percaya diri.";
  if (nilai >= 35) return "🤔 Hmm... mungkin bukan harinya.";
  if (nilai >= 30) return "🫥 Sedikit upgrade skincare boleh tuh.";
  if (nilai >= 20) return "🫣 Coba pose dari sudut lain?";
  if (nilai >= 10) return "😭 Yang penting akhlaknya ya...";
  return "😵 Gagal di wajah, semoga menang di hati.";
}

function komentarCantik(nilai) {
  if (nilai >= 100) return "👑 Cantiknya level dewi Olympus!";
  if (nilai >= 94) return "🌟 Glowing parah! Bikin semua iri!";
  if (nilai >= 90) return "💃 Jalan aja kayak jalan di runway!";
  if (nilai >= 83) return "✨ Inner & outer beauty combo!";
  if (nilai >= 78) return "💅 Cantik ala aesthetic tiktok!";
  if (nilai >= 73) return "😊 Manis dan mempesona!";
  if (nilai >= 68) return "😍 Bisa jadi idol nih!";
  if (nilai >= 54) return "😌 Cantik-cantik adem.";
  if (nilai >= 50) return "😐 Masih oke, tapi bisa lebih wow.";
  if (nilai >= 45) return "😬 Coba lighting lebih terang deh.";
  if (nilai >= 35) return "🤔 Unik sih... kayak seni modern.";
  if (nilai >= 30) return "🫥 Banyak yang lebih butuh makeup.";
  if (nilai >= 20) return "🫣 Mungkin inner beauty aja ya.";
  if (nilai >= 10) return "😭 Cinta itu buta kok.";
  return "😵 Semoga kamu lucu pas bayi.";
}

function komentarKaya(nilai) {
  if (nilai >= 100) return "💎 Sultan auto endorse siapa aja.";
  if (nilai >= 90) return "🛥️ Jet pribadi parkir di halaman rumah.";
  if (nilai >= 80) return "🏰 Rumahnya bisa buat konser.";
  if (nilai >= 70) return "💼 Bos besar! Duit ngalir terus.";
  if (nilai >= 60) return "🤑 Kaya banget, no debat.";
  if (nilai >= 50) return "💸 Kaya, tapi masih waras.";
  if (nilai >= 40) return "💳 Lumayan lah, saldo aman.";
  if (nilai >= 30) return "🏦 Kayanya sih... dari tampang.";
  if (nilai >= 20) return "🤔 Cukup buat traktir kopi.";
  if (nilai >= 10) return "🫠 Kaya hati, bukan dompet.";
  return "🙃 Duitnya imajinasi aja kayaknya.";
}

function komentarMiskin(nilai) {
  if (nilai >= 100) return "💀 Miskin absolut, utang warisan.";
  if (nilai >= 90) return "🥹 Mau beli gorengan mikir 3x.";
  if (nilai >= 80) return "😩 Isi dompet: angin & harapan.";
  if (nilai >= 70) return "😭 Bayar parkir aja utang.";
  if (nilai >= 60) return "🫥 Pernah beli pulsa receh?";
  if (nilai >= 50) return "😬 Makan indomie aja dibagi dua.";
  if (nilai >= 40) return "😅 Listrik token 5 ribu doang.";
  if (nilai >= 30) return "😔 Sering nanya *gratis ga nih?*";
  if (nilai >= 20) return "🫣 Semoga dapet bansos.";
  if (nilai >= 10) return "🥲 Yang penting hidup.";
  return "😵 Gaji = 0, tagihan = tak terbatas.";
}

function komentarJanda(nilai) {
  if (nilai >= 100) return "🔥 Janda premium, banyak yang ngantri.";
  if (nilai >= 90) return "💋 Bekas tapi masih segel.";
  if (nilai >= 80) return "🛵 Banyak yang ngajak balikan.";
  if (nilai >= 70) return "🌶️ Janda beranak dua, laku keras.";
  if (nilai >= 60) return "🧕 Pernah disakiti, sekarang bersinar.";
  if (nilai >= 50) return "🪞 Masih suka upload status galau.";
  if (nilai >= 40) return "🧍‍♀️ Janda low-profile.";
  if (nilai >= 30) return "💔 Ditinggal pas lagi sayang-sayangnya.";
  if (nilai >= 20) return "🫥 Baru ditinggal, masih labil.";
  if (nilai >= 10) return "🥲 Janda lokal, perlu support moral.";
  return "🚫 Masih istri orang, bro.";
}

function komentarPacar(nilai) {
  if (nilai >= 95) return "💍 Sudah tunangan, tinggal nikah.";
  if (nilai >= 85) return "❤️ Pacaran sehat, udah 3 tahun lebih.";
  if (nilai >= 70) return "😍 Lagi anget-angetnya.";
  if (nilai >= 60) return "😘 Sering video call tiap malam.";
  if (nilai >= 50) return "🫶 Saling sayang, tapi LDR.";
  if (nilai >= 40) return "😶 Dibilang pacaran, belum tentu. Tapi dibilang nggak, juga iya.";
  if (nilai >= 30) return "😅 Masih PDKT, nunggu sinyal.";
  if (nilai >= 20) return "🥲 Sering ngechat, tapi dicuekin.";
  if (nilai >= 10) return "🫠 Naksir diam-diam.";
  return "❌ Jomblo murni, nggak ada harapan sementara ini.";
}

function komentarSabar(nilai) {
  if (nilai >= 100) return "🌟 Wah, kamu luar biasa sabar dan hebat!";
  if (nilai >= 94) return "👍 Tetap sabar, kesuksesan sudah dekat.";
  if (nilai >= 90) return "😊 Sabar itu kunci, terus semangat ya!";
  if (nilai >= 83) return "💪 Kamu kuat, sabar sedikit lagi.";
  if (nilai >= 78) return "🌱 Sabar tumbuh jadi kekuatan.";
  if (nilai >= 73) return "✨ Jangan lelah bersabar, hasilnya manis.";
  if (nilai >= 68) return "🧘‍♂️ Tenang, sabar membawa kedamaian.";
  if (nilai >= 54) return "🌸 Sabar itu indah, teruslah berusaha.";
  if (nilai >= 50) return "🌈 Percaya deh, sabar ada hadiahnya.";
  if (nilai >= 45) return "☀️ Sabar sedikit lagi, kamu pasti bisa.";
  if (nilai >= 35) return "🌻 Jangan putus asa, sabar selalu membantu.";
  if (nilai >= 30) return "🕊️ Sabar itu pelajaran berharga.";
  if (nilai >= 20) return "🌿 Terus sabar ya, jangan menyerah.";
  if (nilai >= 10) return "🤲 Sedikit sabar, banyak berkah.";
  return "🙏 Sabar ya, setiap ujian ada hikmahnya.";
}

function komentarTolol(nilai) {
  if (nilai >= 100) return "🤪 Wah, level tololmu sudah master, salut!";
  if (nilai >= 94) return "😂 Udah pinter, tapi masih suka kocak.";
  if (nilai >= 90) return "😜 Kreatif banget, tolol yang menghibur!";
  if (nilai >= 83) return "😅 Santai aja, semua orang kadang tolol.";
  if (nilai >= 78) return "😆 Lumayan kocak, jangan berubah ya.";
  if (nilai >= 73) return "😉 Tolol tapi charming, kombinasi keren.";
  if (nilai >= 68) return "😎 Asal jangan kebanyakan mikir, santuy.";
  if (nilai >= 54) return "🤭 Jangan sedih, tolol itu manusiawi.";
  if (nilai >= 50) return "🙂 Santuy, semua ada waktunya.";
  if (nilai >= 45) return "😬 Masih wajar kok, jangan dipikirin.";
  if (nilai >= 35) return "🤔 Kadang tolol itu bikin lucu, ya kan?";
  if (nilai >= 30) return "😴 Santai, jangan terlalu serius.";
  if (nilai >= 20) return "😐 Bisa jadi tolol pintar, coba terus.";
  if (nilai >= 10) return "🙃 Hidup terlalu singkat buat terlalu serius.";
  return "😵 Wah, kamu jago banget jadi tolol, jangan berubah!";
}

function komentarMati(nilai) {
  if (nilai >= 100) return "💀 1 tahun lagi, kamu bakal jadi legenda!";
  if (nilai >= 94) return "☠️ 5 tahun lagi, siap-siap jadi juara!";
  if (nilai >= 90) return "🪦 10 tahun lagi, perjalanan masih panjang.";
  if (nilai >= 83) return "😵 15 tahun lagi, jangan berhenti berusaha.";
  if (nilai >= 78) return "🦴 20 tahun lagi, kesabaranmu diuji.";
  if (nilai >= 73) return "⚰️ 25 tahun lagi, semangat terus ya!";
  if (nilai >= 68) return "🕯️ 30 tahun lagi, jangan patah semangat.";
  if (nilai >= 54) return "🪦 40 tahun lagi, masih banyak waktu buat berkarya.";
  if (nilai >= 50) return "💤 50 tahun lagi, tetap jaga kesehatan dan mimpi.";
  if (nilai >= 45) return "🛌 60 tahun lagi, santai tapi jangan malas.";
  if (nilai >= 35) return "🌫️ 70 tahun lagi, teruslah berjuang.";
  if (nilai >= 30) return "😶‍🌫️ 80 tahun lagi, perjalanan panjang menanti.";
  if (nilai >= 20) return "🌙 90 tahun lagi, semangat terus hidupnya!";
  if (nilai >= 10) return "🌑 100 tahun lagi, kamu bakal jadi legenda abadi.";
  return "🌌 Lebih dari 100 tahun lagi, perjalananmu baru mulai.";
}

function saveDB() {
  fs.writeFileSync(dbFile, JSON.stringify(users, null, 2));
}

function xpNeeded(level) {
  return level * 800;
}

function getRole(level) {
  if (level <= 1) return "Dhontol";
  if (level <= 3) return "Juragan";
  if (level <= 5) return "Guru Elit";
  if (level <= 7) return "Leluhur";
  if (level <= 8) return "Dewa";
  if (level <= 10) return "Master";
  return "Legenda Tak Terkalahkan";
}

function getBar(current, needed) {
  const totalBlocks = 10;
  const filled = Math.floor((current / needed) * totalBlocks);
  const empty = totalBlocks - filled;
  return `[${"█".repeat(filled)}${"-".repeat(empty)}] ${(current / needed * 800).toFixed(1)}%`;
}

if (!fs.existsSync(dbAntiShare)) fs.writeFileSync(dbAntiShare, "{}");
let antiforward = JSON.parse(fs.readFileSync(dbAntiShare));

if (!fs.existsSync(dbAntiLink)) fs.writeFileSync(dbAntiLink, '{}');
let antilink = JSON.parse(fs.readFileSync(dbAntiLink));

if (!fs.existsSync(CODES_FILE)) fs.writeJsonSync(CODES_FILE, [], { spaces: 2 });
let codes = fs.readJsonSync(CODES_FILE);

if (fs.existsSync(filterFile)) {
  filters = JSON.parse(fs.readFileSync(filterFile));
}

if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "{}");

if(!items.length) loadItemsFromFolder();

function isPremiumActive(user) {
  if (!user.premiumUntil) return false;
  return new Date(user.premiumUntil) > new Date();
}

function parseDuration(str) {
  const match = str.match(/^(\d+)([hdwm])$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const hours = {
    h: 1,
    d: 24,
    w: 24 * 7,
    m: 24 * 30 
  }[unit];

  return value * hours * 60 * 60 * 1000;
}

function loadAdmins() {
  try {
    const data = fs.readFileSync(adminFile, "utf8");
    return JSON.parse(data).admins || [];
  } catch {
    return [];
  }
}

function saveAdmins(adminList) {
  fs.writeFileSync(adminFile, JSON.stringify({ admins: adminList }, null, 2));
}

let ADMIN_BOT_IDS = loadAdmins();

function generateUserCaption({ nama, userId, waktuRunPanel, jumlahFitur, user, refLink, totalRef, totalUsers }) {

  let role = "👤 Free";
  if (userId == OWNER) role = "👑 Owner";
  else if (user.isPremium && isPremiumActive(user)) role = "⭐ Premium";

  return `<blockquote>
👋 Привет брат ${nama} Я — Md-бот, созданный Angkasa. Я готов сделать всё, что вы захотите. Если у вас есть дополнительные функции или предложения, пожалуйста, свяжитесь с разработчиком.
╔════⪼「 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍 」
║ 𝗜𝗱 : <code>${userId}</code>
║ 𝗡𝗮𝗺𝗲 : ${nama}
║ 𝗥𝗼𝗹𝗲 : ${role}
║ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${escapeHtml(VERSION)}
║ 𝗢𝗻𝗹𝗶𝗻𝗲 : ${waktuRunPanel}
║ 𝗡𝗮𝗺𝗮 𝗕𝗼𝘁 : ${escapeHtml(NAMA_BOT)}
║ 𝗧𝗼𝘁𝗮𝗹 𝗟𝗶𝗺𝗶𝘁 : ${DAILY_LIMIT}X + ${user.extraLimit || 0} Referral Bonus
║ 𝗝𝘂𝗺𝗹𝗮𝗵 𝗙𝗶𝘁𝘂𝗿 : ${jumlahFitur}
║ 𝗝𝘂𝗺𝗹𝗮𝗵 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮 : ${totalUsers}
║ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @angkasanyabobo
╠════════════════════⪼
║      𝗘𝗩𝗘𝗡𝗧 𝗚𝗔𝗖𝗛𝗔 𝗩𝗩𝗜𝗣
║ ᴋᴇᴛɪᴋ /gacha ᴜɴᴛᴜᴋ ɢᴀᴄʜᴀ.
║ ʟɪᴍɪᴛ ʜᴀʀɪᴀɴ: ${DAILY_LIMIT + (user.extraLimit || 0)}x
║ ɢᴜɴᴀᴋᴀɴ /listitem ᴜɴᴛᴜᴋ ᴍᴇʟɪʜᴀᴛ
║ ᴊᴜᴍʟᴀʜ ɪᴛᴇᴍ.
║
║ Link Referral kamu:
║ <code>${refLink}</code>
║ Total Referral: ${totalRef}
║ sᴇᴛɪᴀᴘ ʀᴇғᴇʀʀᴀʟ ᴍᴇɴᴀᴍʙᴀʜ
║ 𝟷 ʟɪᴍɪᴛ ɢᴀᴄʜᴀ ʜᴀʀɪᴀɴ ᴋᴀᴍᴜ!
╚════════════════════⪼</blockquote>`;
}

function generateMainMenu() {
  return {
    inline_keyboard: [
      [
        { text: "𝗘𝗩𝗘𝗡𝗧 𝟭", callback_data: "eventsatu" },
        { text: "𝗘𝗩𝗘𝗡𝗧 𝟮", callback_data: "eventdua" }
      ],
      [
        { text: "𝗠𝗢𝗥𝗘", callback_data: "more" },
        { text: "𝗧𝗤𝗧𝗢", callback_data: "tqto" }
      ],
      [
        { text: "𝗧𝗢𝗢𝗟𝗦", callback_data: "tools" },
        { text: "𝗚𝗥𝗢𝗨𝗣", callback_data: "group" }
      ],
      [
        { text: "𝗥𝗘𝗙𝗘𝗥𝗔𝗟𝗟", callback_data: "referral" },
        { text: "𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗘𝗥", url: "https://t.me/angkasanyabobo" }
      ],
    ],
  };
}

function backButton() {
  return { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] };
}

function getMenuCaption(type, nama, waktuRunPanel) {
  const baseHeader = `╔─═⊱ 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍 ─═⬣
║ Nᴀᴍᴇ: —°𝐀𝐧𝐠𝐤𝐚𝐬𝐚
║ User: ${nama}
║ Dᴇᴠ: @angkasanyabobo
║ Vᴇʀsɪᴏɴ: ${VERSION}
║ Oɴʟɪɴᴇ: ${waktuRunPanel}
┗━━━━━━━━━━━━━━━⬣`;

  switch (type) {
    case "eventsatu":
      return `<blockquote>${baseHeader}
┃        𝗘𝗩𝗘𝗡𝗧 𝗠𝗘𝗡𝗨
┃ ━━━━━━━━━━━━━━━━━
┃➹ /gacha
┃ ᴍᴇɴᴅᴀᴘᴀᴛᴋᴀɴ ʜᴀᴅɪᴀʜ ʀᴀɴᴅᴏᴍ
┃➹ /history
┃ ʀɪᴡᴀʏᴀᴛ ᴘᴇɴᴅᴀᴘᴀᴛᴀɴ ᴜsᴇʀ
┃➹ /leaderboard
┃ 𝟷𝟶 ᴛᴏᴘ ᴛᴇʀᴛɪɴɢɢɪ ɢᴀᴄʜᴀ ᴇᴠᴇɴᴛ
┃➹ /addlimit
┃ ᴍᴇɴᴀᴍʙᴀʜᴋᴀɴ ʟɪᴍɪᴛ ᴜsᴇʀ
┃➹ /additem
┃ ᴍᴇɴᴀᴍʙᴀʜᴋᴀɴ ʜᴀᴅɪᴀʜ ɢᴀᴄʜᴀ ᴇᴠᴇɴᴛ
┃➹ /delitem
┃ ᴍᴇɴɢʜᴀᴘᴜs ᴅᴀғᴛᴀʀ ʜᴀᴅɪᴀʜ ɢᴀᴄʜᴀ
┃➹ /listitem
┃ ᴅᴀғᴛᴀʀ ʟɪsᴛ ʜᴀᴅɪᴀʜ ɢᴀᴄʜᴀ ᴇᴠᴇɴᴛ
┃➹ /reloaditem 
┃ ᴍᴇɴᴅᴀᴜʀᴜʟᴀɴɢ ʜᴀᴅɪᴀʜ
┃➹ /backup 
┃ ᴍᴇɴʏɪᴍᴘᴀɴ ғɪʟᴇ ʜᴀᴅɪᴀʜ
┃➹ /createcode 
┃ ᴍᴇᴍʙᴜᴀᴛ ᴄᴏᴅᴇ ʀᴇᴅᴇᴇᴍ
┃➹ /delcode 
┃ ᴍᴇɴɢʜᴀᴘᴜs ᴄᴏᴅᴇ ʀᴇᴅᴇᴇᴍ
┃➹ /listcode 
┃ ʟɪsᴛ ᴄᴏᴅᴇ ʀᴇᴅᴇᴇᴍ
┃➹ /redeem 
┃ ʀᴇᴅᴇᴇᴍ ᴄᴏᴅᴇ ғʀᴇᴇ ʟɪᴍɪᴛ
┃➹ /info 
┃ ɪɴғᴏ ᴅᴀᴛᴀ ᴜsᴇʀ
┃➹ /pengumuman 
┃ ʙʀᴏᴀᴅᴄᴀsᴛ ᴋᴇ sᴇᴍᴜᴀ ᴜsᴇʀ
┃ ᴅᴀғᴛᴀʀ ᴀᴅᴍɪɴ
┃➹ /send 
┃ ᴍᴇɴɢɪʀɪᴍ ʟɪᴍɪᴛ ᴋᴇ ᴜsᴇʀ ʟᴀɪɴ
┃ ━━━━━━━━━━━━━━━━━
┃       —°𝐀𝐧𝐠𝐤𝐚𝐬𝐚
╰━━━━━━━━━━━━━━━━━╯</blockquote>`;
    case "eventdua":
      return `<blockquote>${baseHeader}
┃        𝗘𝗩𝗘𝗡𝗧 𝗠𝗘𝗡𝗨
┃ ━━━━━━━━━━━━━━━━━
┃➹ /addprem 
┃ ᴍᴇɴɢᴜʙᴀʜ ᴜsᴇʀ ᴛᴏ ᴘʀᴇᴍɪᴜᴍ
┃➹ /cekprem 
┃ ᴄᴇᴋ ɪɴғᴏ ᴘʀᴇᴍɪᴜᴍ
┃➹ /info 
┃ ɪɴғᴏ ᴅᴀᴛᴀ ᴜsᴇʀ
┃➹ /addadmin 
┃ ᴍᴇɴᴀᴍʙᴀʜᴋᴀɴ ᴀᴅᴍɪɴ
┃➹ /deladmin 
┃ ᴍᴇɴɢʜᴀᴘᴜs ᴀᴅᴍɪɴ
┃➹ /listadmin 
┃ ᴅᴀғᴛᴀʀ ᴀᴅᴍɪɴ
┃ ━━━━━━━━━━━━━━━━━
┃       —°𝐀𝐧𝐠𝐤𝐚𝐬𝐚
╰━━━━━━━━━━━━━━━━━╯</blockquote>`;
    case "group":
      return `<blockquote>${baseHeader}
┃        𝗚𝗥𝗢𝗨𝗣 𝗠𝗘𝗡𝗨
┃ ━━━━━━━━━━━━━━━━━
┃➹ /jasher
┃ ʙʀᴏᴀᴅᴄᴀsᴛ ᴘᴇsᴀɴ ᴋᴇ ɢʀᴏᴜᴘ
┃➹ /brat
┃ ʙɪᴋɪɴ sᴛɪᴄᴋᴇʀ
┃➹ /iqc
┃ ɪᴘʜᴏɴᴇ ǫᴜᴏᴛᴇ ᴄʜᴀᴛ ᴛᴇxᴛ
┃➹ /play
┃ ɴʏᴀʀɪ ʟᴀɢᴜ sᴇsᴜᴀɪ ᴊᴜᴅᴜʟ
┃➹ /tiktok
┃ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅɪᴏ ᴅᴀʀɪ ʟɪɴᴋ ᴛᴛ
┃➹ /youtube
┃ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅɪᴏ ᴅᴀʀɪ ʟɪɴᴋ ʏᴛ
┃➹ /cariyoutube
┃ ᴄᴀʀɪ ʟᴀɢᴜ ʙᴇʙᴀs
┃➹ /hytamkan
┃ ᴍᴇɴɢʜɪᴛᴀᴍᴋᴀɴ ᴋᴜʟɪᴛ ᴋᴀʀᴀᴋᴛᴇʀ
┃➹ /cecan
┃ ғᴏᴛᴏ ᴄᴇᴄᴀɴ
┃ ━━━━━━━━━━━━━━━━━
┃       —°𝐀𝐧𝐠𝐤𝐚𝐬𝐚
╰━━━━━━━━━━━━━━━━━╯</blockquote>`;
    case "tools":
      return `<blockquote>${baseHeader}
┃        𝗧𝗢𝗢𝗟𝗦 𝗠𝗘𝗡𝗨
┃ ━━━━━━━━━━━━━━━━━
┃➹ /id
┃ ᴄᴇᴋ ɪᴅ ᴜsᴇʀ
┃➹ /hacknik
┃ ᴄᴇᴋ ᴅᴀᴛᴀ ɴɪᴋ
┃➹ /gethtml
┃ ᴀᴍʙɪʟ ᴄᴏᴅᴇ ʜᴛᴍʟ ᴡᴇʙ
┃➹ /tourl
┃ ᴍᴇɴɢᴜʙᴀʜ ᴍᴇᴅɪᴀ ᴛᴏ ᴜʀʟ
┃➹ /nglspam
┃ sᴘᴀᴍ ʟɪɴᴋ ɴɢʟ
┃➹ /antishare
┃ ᴅᴇʟᴇᴛᴇ sʜᴀʀᴇ ᴛᴇxᴛ
┃➹ /antilink
┃ ᴅᴇʟᴇᴛᴇ sʜᴀʀᴇ ʟɪɴᴋ
┃➹ /hubungiowner
┃ ᴍᴇɴɢʜᴜʙᴜɴɢɪ ᴏᴡɴᴇʀ ᴠɪᴀ ʙᴏᴛ
┃➹ /bypass
┃ ᴍᴇᴍᴀsᴀɴɢ ʙʏᴘᴀss ʙᴜᴀᴛ sᴄ ᴅʙ
┃➹ /filter
┃ ʀᴇsᴘᴏɴ ᴋᴀᴛᴀ ʏᴀɴɢ ᴅɪ ғɪʟᴛᴇʀ
┃➹ /pw
┃ ᴍᴇɴᴀᴍʙᴀʜᴋᴀɴ sɪsᴛᴇᴍ ᴘᴡ
┃➹ /rasukbot
┃ ᴋɪʀɪᴍ ᴛᴇxᴛ ʙᴏᴛ ᴏʀᴀɴɢ
┃ ━━━━━━━━━━━━━━━━━
┃       —°𝐀𝐧𝐠𝐤𝐚𝐬𝐚
╰━━━━━━━━━━━━━━━━━╯</blockquote>`;
    case "more":
      return `<blockquote>${baseHeader}
┃        𝗠𝗢𝗥𝗘 𝗠𝗘𝗡𝗨
┃ ━━━━━━━━━━━━━━━━━
┃ /cekkodam
┃ /cektampan
┃ /cekcantik
┃ /cekkaya
┃ /cekmiskin
┃ /cekjanda
┃ /cekpacar
┃ /ceksabar
┃ /cektolol
┃ /cekmati
┃ ━━━━━━━━━━━━━━━━━
┃       —°𝐀𝐧𝐠𝐤𝐚𝐬𝐚
╰━━━━━━━━━━━━━━━━━╯</blockquote>`;
    case "tqto":
      return `<blockquote>${baseHeader}
╭──〔 🤍 𝗦𝗨𝗣𝗣𝗢𝗥𝗧 〕──╮
├• Allah SWT ( The God )
├• Orang Tua ( My Support )
├• Zahra ( My Sister )
├• Ftmncloud ( Friend )
├• Rafzx ( Friend )
├• Azka Lyoraa ( Friend )
├• Axcal Official ( Friend )
├• Semua Subscribe
├• Semua Pengguna
├• Semua Buyer
╰──────────────────╯</blockquote>`;
    default:
      return `<blockquote>${baseHeader}\nMenu tidak dikenal.</blockquote>`;
  }
}

//===================== COMMAND =====================

bot.onText(/^\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;
  const refId = match[1];
  const waktuRunPanel = getUptime();
  const jumlahFitur = "29";
  const nama = escapeHtml(msg.from.first_name || "User");
  const totalUsers = Object.keys(users).length;
  
  if (maintenanceCheck(bot, msg)) return;

  const user = ensureUserRecord(userId);

  if (refId && refId !== userId && !user.referredBy) {
    const refUser = ensureUserRecord(refId);
    user.referredBy = refId;
    refUser.referrals = (refUser.referrals || 0) + 1;
    refUser.extraLimit = (refUser.extraLimit || 0) + 2;
    saveUsers();

    await bot.sendMessage(refId, `<blockquote>🎉 Seseorang baru join lewat link referral kamu!\n📈 Total referral: ${refUser.referrals}\n✨ Limit gacha kamu bertambah 2!</blockquote>`, {
    parse_mode: "HTML"
    });
  }
  let role = "👤 Free";
  if (userId == OWNER) role = "👑 Owner";
  else if (user.isPremium && isPremiumActive(user)) role = "⭐ Premium";

  const me = await bot.getMe();
  const refLink = `https://t.me/${USERNAME_BOT}?start=${userId}`;
  const totalRef = user.referrals || 0;

  const caption = `<blockquote>👋 Привет брат ${nama} Я — Md-бот, созданный Angkasa. Я готов сделать всё, что вы захотите. Если у вас есть дополнительные функции или предложения, пожалуйста, свяжитесь с разработчиком.
╔════⪼「 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍 」
║ 𝗜𝗱 : <code>${userId}</code>
║ 𝗡𝗮𝗺𝗲 : ${nama}
║ 𝗥𝗼𝗹𝗲 : ${role}
║ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${escapeHtml(VERSION)}
║ 𝗢𝗻𝗹𝗶𝗻𝗲 : ${waktuRunPanel}
║ 𝗡𝗮𝗺𝗮 𝗕𝗼𝘁 : ${escapeHtml(NAMA_BOT)}
║ 𝗧𝗼𝘁𝗮𝗹 𝗟𝗶𝗺𝗶𝘁 : ${DAILY_LIMIT}X + ${user.extraLimit || 0} Referral Bonus
║ 𝗝𝘂𝗺𝗹𝗮𝗵 𝗙𝗶𝘁𝘂𝗿 : ${jumlahFitur}
║ 𝗝𝘂𝗺𝗹𝗮𝗵 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮 : ${totalUsers}
║ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @angkasanyabobo
╠════════════════════⪼
║      𝗘𝗩𝗘𝗡𝗧 𝗚𝗔𝗖𝗛𝗔 𝗩𝗩𝗜𝗣
║ ᴋᴇᴛɪᴋ /gacha ᴜɴᴛᴜᴋ ɢᴀᴄʜᴀ.
║ ʟɪᴍɪᴛ ʜᴀʀɪᴀɴ: ${DAILY_LIMIT + (user.extraLimit || 0)}x
║ ɢᴜɴᴀᴋᴀɴ /listitem ᴜɴᴛᴜᴋ ᴍᴇʟɪʜᴀᴛ
║ ᴊᴜᴍʟᴀʜ ɪᴛᴇᴍ.
║
║ Link Referral kamu:
║ <code>${refLink}</code>
║ Total Referral: ${totalRef}
║ sᴇᴛɪᴀᴘ ʀᴇғᴇʀʀᴀʟ ᴍᴇɴᴀᴍʙᴀʜ
║ 𝟷 ʟɪᴍɪᴛ ɢᴀᴄʜᴀ ʜᴀʀɪᴀɴ ᴋᴀᴍᴜ!
╚════════════════════⪼</blockquote>`;

  const menu = {  
    caption,  
    parse_mode: 'HTML',  
    reply_markup: {  
      inline_keyboard: [  
        [
        { text: "𝗘𝗩𝗘𝗡𝗧 𝟭", callback_data: "eventsatu" },
        { text: "𝗘𝗩𝗘𝗡𝗧 𝟮", callback_data: "eventdua" }
      ],
      [
        { text: "𝗠𝗢𝗥𝗘", callback_data: "more" },
        { text: "𝗧𝗤𝗧𝗢", callback_data: "tqto" }
      ],
      [
        { text: "𝗧𝗢𝗢𝗟𝗦", callback_data: "tools" },
        { text: "𝗚𝗥𝗢𝗨𝗣", callback_data: "group" }
      ],
      [
        { text: "𝗥𝗘𝗙𝗘𝗥𝗔𝗟𝗟", callback_data: "referral" },
        { text: "𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗘𝗥", url: "https://t.me/angkasanyabobo" }
      ],
      ]
    }  
  };  

  bot.sendVideo(chatId, "https://files.catbox.moe/5soi30.mp4", menu);
});

bot.on("callback_query", async (query) => {
  const data = query.data;
  const userId = query.from.id.toString();
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const nama = escapeHtml(query.from.first_name || "User");
  const waktuRunPanel = getUptime();
  const jumlahFitur = "29";

  if (maintenanceCheck(bot, query)) return;

  await bot.answerCallbackQuery(query.id);
  await bot.deleteMessage(chatId, messageId);

  const user = ensureUserRecord(userId);
  const me = await bot.getMe();
  const refLink = `https://t.me/${me.username}?start=${userId}`;
  const totalRef = user.referrals || 0;

  if (data === "back_home") {
    const users = JSON.parse(fs.readFileSync('./database/users.json'));
    const totalUsers = Object.keys(users).length;
    const caption = generateUserCaption({
      nama,
      userId,
      waktuRunPanel,
      jumlahFitur,
      user,
      refLink,
      totalRef,
      totalUsers
    });

    return bot.sendVideo(chatId, "https://files.catbox.moe/5soi30.mp4", {
      caption,
      parse_mode: "HTML",
      reply_markup: generateMainMenu(),
    });
  }

  if (data === "referral") {
    const caption = `<blockquote>🎯 Link Referral Kamu:\n<code>${refLink}</code>\n📊 Total Referral: ${totalRef}\n\n🎁 Setiap referral nambah 2 limit gacha harian!</blockquote>`;
    return bot.sendMessage(chatId, caption, { parse_mode: "HTML", reply_markup: backButton() });
  }

  const validMenus = ["eventsatu", "eventdua", "group", "tools", "more", "tqto"];
  if (validMenus.includes(data)) {
    const caption = getMenuCaption(data, nama, waktuRunPanel);
    return bot.sendVideo(chatId, "https://files.catbox.moe/5soi30.mp4", {
      caption,
      parse_mode: "HTML",
      reply_markup: backButton(),
    });
  }
});

//===================== GROUP =====================

bot.onText(/^\/gacha\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (msg.chat.type !== 'private') {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Hanya Bisa Di Gunakan Di Private Chat.</blockquote>`, { parse_mode: "HTML" });
  }

  if (maintenanceCheck(bot, msg, chatId)) return;

  const member = await bot.getChatMember(CHANNEL_ID, userId);
  if (member.status === 'left' || member.status === 'kicked') {
    return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
    });
  }

  if (items.length === 0)
    return bot.sendMessage(chatId, `<blockquote>❌ Belum ada item di gacha.</blockquote>`, {
      parse_mode: "HTML"
    });

  const user = ensureUserRecord(userId);
  const isAdminBot = Array.isArray(admins) && admins.includes(userId);
  resetWeeklyIfNeeded(user);
  
  const now = Date.now();
  if (user.lastGacha && now - user.lastGacha < GACHA_COOLDOWN) {
    const sisa = Math.ceil((GACHA_COOLDOWN - (now - user.lastGacha)) / 1000);
    return bot.sendMessage(chatId, `<blockquote>🕒 Tunggu ${sisa} detik sebelum gacha lagi!</blockquote>`, { parse_mode: "HTML" });
  }

  user.lastGacha = now;
  
  let isPremium = false;
  if (user.isPremium && user.premiumUntil) {
    const now = new Date();
    const expire = new Date(user.premiumUntil);
    if (expire > now) {
      isPremium = true;
    } else {
      user.isPremium = false;
      user.premiumUntil = null;
    }
  }

  const bonusLimit = user.extraLimit || 0;
  const totalLimit = DAILY_LIMIT + bonusLimit;

  if (!isPremium && !isAdminBot && user.count >= totalLimit) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Gacha hari ini sudah habis (${totalLimit}).\n🕒 Coba lagi besok atau beli limit tambahan.</blockquote>`, {
    parse_mode: "HTML"
  });
}

  const kocokMsg = await bot.sendMessage(chatId, `<blockquote>🎰 Mengocok hadiah...</blockquote>`, { parse_mode: "HTML" });

  const animasi = [
    `<blockquote>🔄 Lagi muter-muter...</blockquote>`,
    `<blockquote>💫 Hadiah hampir keluar...</blockquote>`,
    `<blockquote>🎁 Sebentar lagi ketahuan...</blockquote>`
  ];

  for (let i = 0; i < animasi.length; i++) {
    await new Promise(r => setTimeout(r, 1500));
    await bot.editMessageText(animasi[i], {
      chat_id: chatId,
      message_id: kocokMsg.message_id,
      parse_mode: "HTML"
    });
  }

  const idx = getRandomInt(items.length);
  const item = items[idx];
  const filepath = path.join(GACHA_FOLDER, item.filename);

  if (!fs.existsSync(filepath)) {
    return bot.editMessageText(`<blockquote>⚠️ File item "${item.filename}" tidak ditemukan. Owner perlu cek folder gacha.</blockquote>`, {
      chat_id: chatId,
      message_id: kocokMsg.message_id,
      parse_mode: "HTML"
    });
  }

  if (!isAdminBot) {
    user.count = (user.count || 0) + 1;
  if (!isPremium && user.extraLimit && user.extraLimit > 0) {
    user.extraLimit -= 1;
    }
  }

const code = Math.random().toString(36).slice(2, 8).toUpperCase();
user.totalWins = (user.totalWins || 0) + 1;
user.history = user.history || [];
user.history.unshift({ time: new Date().toISOString(), filename: item.filename, code });

saveUsers();

  const sisaLimit = isPremium
  ? "∞"
  : (DAILY_LIMIT + (user.extraLimit || 0) - (user.count || 0));

const statusText = `<blockquote>✅ GACHA SELESAI!

🎁 Hadiah: ${item.filename}
🔑 Kode: <code>${code}</code>
📅 Gacha hari ini: ${user.count}/${isPremium ? "∞" : DAILY_LIMIT + (user.extraLimit || 0)}
💫 Sisa limit: ${sisaLimit}

${isPremium ? "👑 Kamu pengguna Premium — tanpa batas!" : "📦 Bonus limit dari admin/referral aktif."}
</blockquote>`;
  await bot.editMessageText(statusText, {
    chat_id: chatId,
    message_id: kocokMsg.message_id,
    parse_mode: "HTML"
  });

  const ext = path.extname(item.filename).toLowerCase();

  try {
    await new Promise(res => setTimeout(res, 1000));
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      await bot.sendPhoto(chatId, filepath, { caption: `🎁 Hadiah: ${item.filename}` });
    } else {
      await bot.sendDocument(chatId, filepath, {}, { filename: item.filename });
    }

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      try {
        fs.unlinkSync(filepath);
        const index = items.findIndex(i => i.filename === item.filename);
        if (index !== -1) {
          items.splice(index, 1);
          saveItems();
        }
        console.log(`[AUTO DELETE] Foto ${item.filename} dihapus setelah diklaim.`);
      } catch (err) {
        console.error('❌ Gagal hapus foto hadiah:', err);
      }
    }
  } catch (err) {
    console.error('❌ Error kirim file gacha:', err);
    bot.sendMessage(chatId, '❌ Gagal mengirim file. Owner cek izin file/bot.');
  }
});

bot.onText(/^\/history$/i, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const user = ensureUserRecord(userId);

  if (maintenanceCheck(bot, msg, chatId)) return;
  
  if (!user.history || user.history.length === 0)
    return bot.sendMessage(chatId, `<blockquote>Belum ada riwayat gacha.</blockquote>`, {
    parse_mode: "HTML"
    });

  const lines = user.history.slice(0, 10).map((h, i) =>
    `${i + 1}. 🎁 ${h.filename}\n🔑 ${h.code} — 📅 ${h.time.slice(0, 19).replace('T', ' ')}`
  );
  
  bot.sendMessage(chatId, `<blockquote>📜 Riwayat Gacha Kamu:\n\n${lines.join('\n\n')}</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.onText(/^\/leaderboard$/i, (msg) => {
  const chatId = msg.chat.id;

  if (maintenanceCheck(bot, msg, chatId)) return;

  const ranks = Object.entries(users)
    .map(([uid, u]) => ({
      username: escapeHtml(u.username ? `@${u.username}` : (u.name || `User_${uid}`)),
      gacha: u.totalWins || 0,
      teman: u.referrals || 0
    }))
    .sort((a, b) => b.gacha - a.gacha || b.teman - a.teman)
    .slice(0, 10);

  if (ranks.length === 0) {
    return bot.sendMessage(chatId, `<blockquote>📭 Belum ada data leaderboard.</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  const lines = ranks.map((r, i) =>
    `#${i + 1}. ${r.username}\n🎲 Gacha: ${r.gacha}x | 👥 Teman: ${r.teman}`
  ).join('\n\n');

  const totalUsers = Object.keys(users).length;
  const text = `<blockquote>🏆 TOP 10 GACHA\n\n${lines}\n\n📊 Total pengguna: ${totalUsers}</blockquote>`;

  bot.sendMessage(chatId, text, { parse_mode: "HTML" });
});

bot.onText(/^\/addlimit$/i, (msg) => {
  const chatId = msg.chat.id;
  const ownerId = msg.from.id;
  if (ownerId !== OWNER) 
    return bot.sendMessage(chatId, '<blockquote>🚫 Akses ditolak! Hanya Owner Yang Dapat Menambahkan Limit.</blockquote>', {
    parse_mode: "HTML"
    });
  
  bot.sendMessage(chatId, `<blockquote>⚠️ Contoh penggunaan:\n\n<code>/addlimit [id_user] [jumlah]</code></blockquote>`, {
    parse_mode: "HTML"
  });
});

bot.onText(/^\/addlimit (\d+) (\d+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const ownerId = msg.from.id;
  const targetId = parseInt(match[1]);
  const jumlah = parseInt(match[2]);
  
  if (ownerId !== OWNER) 
    return bot.sendMessage(chatId, '<blockquote>🚫 Akses ditolak! Hanya Owner Yang Dapat Menambahkan Limit.</blockquote>', {
    parse_mode: "HTML"
    });

  if (!targetId || isNaN(targetId) || !jumlah || isNaN(jumlah)) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Format salah!\n\nGunakan:\n<code>/addlimit [id_user] [jumlah]</code></blockquote>`, {
    parse_mode: "HTML"
    });
  }

  if (!users[targetId]) {
    users[targetId] = {
      id: targetId,
      limit: DAILY_LIMIT,
      extraLimit: 0,
      refCount: 0
    };
  }

  users[targetId].extraLimit = (users[targetId].extraLimit || 0) + jumlah;
  saveUsers();

  const totalLimit = DAILY_LIMIT + (users[targetId].extraLimit || 0);

  const text = `<blockquote>✅ Limit user <code>${targetId}</code> telah ditambah ${jumlah}x!
📊 Sisa limit user hari ini: ${totalLimit}\n
🎟 Bonus tambahan: ${users[targetId].extraLimit}</blockquote>`;

  await bot.sendMessage(chatId, text, { parse_mode: "HTML" });

  await bot.sendMessage(targetId, `<blockquote>🎁 Limit kamu telah ditambah sebanyak ${jumlah}x oleh owner!\n📊 Total limit harianmu sekarang: ${totalLimit}</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.onText(/^\/additem(?: (.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const reply = msg.reply_to_message;
  const argName = match[1]?.trim();
  const userId = msg.from.id;

  if (userId !== OWNER) return bot.sendMessage(chatId, `<blockquote>🚫 Akses ditolak! Hanya Owner Yang Dapat Menambahkan Item.</blockquote>`, {
    parse_mode: "HTML"
  });

  if (!reply || (!reply.document && !reply.photo && !reply.video && !reply.audio)) {
    return bot.sendMessage(chatId,
      `<blockquote>⚠️ Reply ke file atau foto yang mau dijadikan hadiah gacha.\n\nContoh:\nKirim foto lalu reply dengan /additem</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  try {
    let fileId, fileName, isPhoto = false;

    if (reply.document) {
      fileId = reply.document.file_id;
      fileName = argName || reply.document.file_name || `file_${Date.now()}`;
    } else if (reply.photo) {
      const photo = reply.photo.pop();
      fileId = photo.file_id;
      isPhoto = true;

      const existingFiles = fs.readdirSync(GACHA_FOLDER)
        .filter(f => /^dana\d+\.jpg$/i.test(f));
      let nextNum = 1;
      if (existingFiles.length > 0) {
        const nums = existingFiles.map(f => parseInt(f.match(/\d+/)[0]));
        nextNum = Math.max(...nums) + 1;
      }

      fileName = `dana${nextNum}.jpg`;
    } else if (reply.video) {
      fileId = reply.video.file_id;
      fileName = argName || reply.video.file_name || `video_${Date.now()}.mp4`;
    } else if (reply.audio) {
      fileId = reply.audio.file_id;
      fileName = argName || reply.audio.file_name || `audio_${Date.now()}.mp3`;
    } else {
      return bot.sendMessage(chatId, '❌ Format file tidak dikenali.');
    }

    const fileLink = await bot.getFileLink(fileId);
    const savePath = path.join(GACHA_FOLDER, fileName);
    const res = await axios.get(fileLink, { responseType: 'arraybuffer' });
    fs.writeFileSync(savePath, res.data);

    if (!items.find(i => i.filename === fileName)) {
      items.push({ filename: fileName });
      saveItems();
    }

    bot.sendMessage(chatId, `<blockquote>✅ 1 file berhasil ditambahkan:\n${fileName}</blockquote>`, {
      parse_mode: 'HTML'
    });

    const users = JSON.parse(fs.readFileSync('./database/users.json'));
    const notifText = `<blockquote>📢 Item Baru Telah Ditambahkan ke Gacha!\n\n🎁 Nama Item: <code>${fileName}</code>\n\nKamu bisa coba keberuntunganmu pakai /gacha ✨</blockquote>`;

    for (const id in users) {
      try {
        await bot.sendMessage(id, notifText, { parse_mode: "HTML" });
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.log(`Gagal kirim ke ${id}: ${e.message}`);
      }
    }

    if (isPhoto) {
      setTimeout(() => {
        if (fs.existsSync(savePath)) {
          fs.unlinkSync(savePath);
          const idx = items.findIndex(i => i.filename === fileName);
          if (idx !== -1) {
            items.splice(idx, 1);
            saveItems();
          }
          console.log(`[AUTO DELETE] Foto ${fileName} dihapus otomatis.`);
        }
      }, 3 * 60 * 60 * 1000);
    }

  } catch (err) {
    console.error('AddItem Error:', err);
    bot.sendMessage(chatId, `<blockquote>❌ Gagal menyimpan file, coba lagi.</blockquote>`);
  }
});

bot.onText(/^\/delitem(?:\s+(.+))?/i, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];

  if (!text) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Contoh penggunaan:\n\n<code>/delitem NamaItem</code></blockquote>`, {
      parse_mode: "HTML"
    });
  }

  if (msg.from.id !== OWNER) {
    return bot.sendMessage(chatId, `<blockquote>🚫 Akses ditolak! Hanya Owner yang dapat menghapus item.</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  const filename = sanitizeFilename(text.trim());
  const idx = items.findIndex(i => i.filename === filename);

  if (idx === -1) {
    return bot.sendMessage(chatId, `<blockquote>❌ Item ${filename} tidak ditemukan.</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  items.splice(idx, 1);
  saveItems();

  bot.sendMessage(chatId, `<blockquote>✅ Item dihapus: ${filename}</blockquote>`, {
    parse_mode: "HTML"
  });
});

bot.onText(/^\/listitem$/i, (msg) => {
  const chatId = msg.chat.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  if (!items.length)
    return bot.sendMessage(chatId, `<blockquote>Belum Ada Daftar Hadiah Yang Di Tambahkan</blockquote>`, {
    parse_mode: "HTML"
    });

  const list = items.map((it, i) => `${i + 1}. ${it.filename}`).join('\n');
  bot.sendMessage(chatId, `<blockquote>📦 Daftar item (${items.length}):\n\n${list}</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.onText(/^\/reloaditem$/i, (msg) => {
  if (msg.from.id !== OWNER)
    return bot.sendMessage(msg.chat.id, `<blockquote>🚫 Akses ditolak! Hanya Owner Yang Dapat Reload Item.</blockquote>`, {
    parse_mode: "HTML"
  });

  const loaded = loadItemsFromFolder();
  bot.sendMessage(msg.chat.id, `<blockquote>✅ Item Berhasil Di reload. Total items: ${loaded.length}</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.onText(/^\/backup$/i, (msg) => {
  if (msg.from.id !== OWNER)
    return bot.sendMessage(msg.chat.id, `<blockquote>🚫 Akses ditolak! Hanya Owner Yang Dapat Backup.</blockquote>`, {
    parse_mode: "HTML"
  });

  bot.sendDocument(msg.chat.id, ITEMS_FILE, {}, { filename: 'items.json' });
  bot.sendDocument(msg.chat.id, USERS_FILE, {}, { filename: 'users.json' });
});

bot.onText(/^\/createcode\s+([A-Za-z0-9_-]+)\s+(\d+)$/i, (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  if (fromId !== OWNER)
    return bot.sendMessage(chatId, `<blockquote>🚫 Hanya owner yang bisa membuat code.</blockquote>`, { parse_mode: "HTML" });

  const codeStr = match[1].toUpperCase();
  const amount = parseInt(match[2], 10);

  if (!codeStr || isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Format salah.\nGunakan: /createcode CODE AMOUNT\nContoh: /createcode BONUS50 50</blockquote>`, {
    parse_mode: "HTML"
  });
  }

  if (codes.find(c => c.code === codeStr)) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Kode ${codeStr} sudah ada.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRATION_MINUTES * 60 * 1000);
  const localTime = new Date(expiresAt.getTime() + 7 * 60 * 60 * 1000);
  const formattedTime = localTime.toLocaleTimeString('id-ID', { hour12: false });

  const newCode = {
    code: codeStr,
    amount,
    createdBy: fromId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    redeemedBy: []
  };

  codes.push(newCode);
  saveCodes();

  bot.sendMessage(chatId, `<blockquote>✅ Kode <code>${codeStr}</code> berhasil dibuat!\n🎟 Bonus: +${amount} extraLimit\n⏰ Berlaku sampai: ${formattedTime} WIB (${EXPIRATION_MINUTES} menit)\n🌍 Semua orang bisa redeem sekali.</blockquote>`, {
  parse_mode: 'HTML'
  });

  setTimeout(() => {
    const index = codes.findIndex(c => c.code === codeStr);
    if (index !== -1) {
      codes.splice(index, 1);
      saveCodes();
      console.log(`🕒 Kode ${codeStr} otomatis dihapus (expired).`);
    }
  }, EXPIRATION_MINUTES * 60 * 1000);
});

bot.onText(/^\/listcode$/i, (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER)
    return bot.sendMessage(chatId, `<blockquote>🚫 Akses ditolak! Hanya Owner yang dapat melihat daftar kode.</blockquote>`, { parse_mode: "HTML" });

  if (!codes.length)
    return bot.sendMessage(chatId, `<blockquote>📭 Belum ada kode redeem yang aktif.</blockquote>`, { parse_mode: "HTML" });

  const now = new Date();

  const lines = codes.map(c => {
    const expireDate = new Date(c.expiresAt);
    const expired = expireDate < now ? '❌ Expired' : '✅ Aktif';
    const localExpire = new Date(expireDate.getTime() + 7 * 60 * 60 * 1000);
    const expireTime = localExpire.toLocaleTimeString('id-ID', { hour12: false });
    const redeemedCount = c.redeemedBy ? c.redeemedBy.length : 0;

    return `<blockquote>🎟️ ${c.code}\n💰 Bonus: +${c.amount} extraLimit\n👥 Sudah digunakan: ${redeemedCount} user\n${expired} — ⏰ Exp: ${expireTime} WIB</blockquote>`;
  });

  bot.sendMessage(chatId, `<blockquote>📜 Daftar Kode Redeem:\n\n${lines.join('\n')}</blockquote>`, { parse_mode: 'HTML' });
});

bot.onText(/^\/redeem(?:\s+([A-Za-z0-9_-]+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const codeStr = match[1] ? match[1].toUpperCase() : null;

  if (maintenanceCheck(bot, msg, chatId)) return;

  let member;
try {
  member = await bot.getChatMember(CHANNEL_ID, userId);
} catch (err) {
  console.error("Error getChatMember:", err.message);
  return bot.sendMessage(chatId, `<blockquote>⚠️ Gagal memeriksa keanggotaan channel.\nPastikan bot sudah dimasukkan ke channel official dan CHANNEL_ID benar.</blockquote>`, { parse_mode: "HTML" });
}

if (!member || member.status === "left" || member.status === "kicked") {
  return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]],
    },
  });
}

  if (!codeStr) {
    return bot.sendMessage(chatId, `<blockquote>⚙️ Cara pakai:\n/redeem code\n\nContoh:\n/redeem BONUS50</blockquote>`, { parse_mode: "HTML" });
  }

  const codeObj = codes.find(c => c.code === codeStr);
  if (!codeObj)
    return bot.sendMessage(chatId, `<blockquote>❌ Kode ${codeStr} tidak valid.</blockquote>`, { parse_mode: "HTML" });

  const now = new Date();
  const expiresAt = new Date(codeObj.expiresAt);
  if (expiresAt < now) {
    return bot.sendMessage(chatId, `<blockquote>⏰ Kode ${codeStr} sudah expired dan tidak bisa digunakan lagi.</blockquote>`, { parse_mode: "HTML" });
  }

  if (!users[userId]) {
    users[userId] = {
      id: userId,
      name: msg.from.first_name || '',
      extraLimit: 0,
      redeemedCodes: []
    };
  }

  if (!Array.isArray(users[userId].redeemedCodes)) {
    users[userId].redeemedCodes = [];
  }

  if (!Array.isArray(codeObj.redeemedBy)) {
    codeObj.redeemedBy = [];
  }

  if (users[userId].redeemedCodes.includes(codeStr)) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Kamu sudah pernah redeem kode ini sebelumnya.</blockquote>`, { parse_mode: "HTML" });
  }

  users[userId].extraLimit = (users[userId].extraLimit || 0) + codeObj.amount;
  users[userId].redeemedCodes.push(codeStr);
  codeObj.redeemedBy.push(userId);

  saveUsers();
  saveCodes();

  bot.sendMessage(chatId, `<blockquote>✅ Berhasil redeem ${codeStr}!\n🎟 Kamu mendapatkan +${codeObj.amount} extraLimit.\n📊 Total extraLimit kamu sekarang: ${users[userId].extraLimit}</blockquote>`, { parse_mode: 'HTML' });
});

bot.onText(/^\/addprem(?:\s+(\d+))?(?:\s+(\d+[hdwm]))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const idArg = match[1];
  const durationStr = match[2];
  const reply = msg.reply_to_message;
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  const ownerList = Array.isArray(OWNER) ? OWNER : [OWNER];
  if (!ownerList.includes(adminId))
    return bot.sendMessage(chatId, `<blockquote>❌ Kamu tidak punya izin menggunakan perintah ini.</blockquote>`, {
parse_mode: "HTML"
});

  const userId = idArg || (reply ? reply.from.id : null);
  if (!userId)
    return bot.sendMessage(chatId, `<blockquote>⚠️ Gunakan:\n\n- /addprem id user durasi\n- atau reply ke user lalu ketik: /addprem 3d</blockquote>`, {
      parse_mode: "HTML"
    });

  if (!durationStr)
    return bot.sendMessage(chatId, `<blockquote>⚠️ Harap masukkan durasi!\nContoh: <code>/addprem 3d</code> atau <code>/addprem 12h</code></blockquote>`, {
      parse_mode: "HTML"
    });

  const ms = parseDuration(durationStr);
  if (!ms)
    return bot.sendMessage(chatId, `<blockquote>⚠️ Format durasi salah! Gunakan satuan: h/d/w/m</blockquote>`, {
    parse_mode: "HTML"
    });

  const user = ensureUserRecord(userId);
  const now = new Date();
  const expire = new Date(now.getTime() + ms);
  
  if (user.isPremium && user.premiumUntil && new Date(user.premiumUntil) > now) {
    const oldExpire = new Date(user.premiumUntil);
    user.premiumUntil = new Date(oldExpire.getTime() + ms).toISOString();
  } else {
    user.isPremium = true;
    user.premiumUntil = expire.toISOString();
  }

  saveDB();

  const wibTime = new Date(user.premiumUntil).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  bot.sendMessage(
    chatId,
    `<blockquote>✅ User ID: <code>${userId}</code>\n⭐ Status: Premium aktif selama ${durationStr}\n📅 Berakhir: ${wibTime}</blockquote>`,
    { parse_mode: "HTML" }
  );

  bot.sendMessage(
    userId,
    `<blockquote>🎉 Selamat!\nKamu baru saja mendapatkan akses Premium selama ${durationStr}!\n\n📅 Aktif hingga: ${wibTime}\n✨ Nikmati fitur tanpa batas!</blockquote>`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/^\/cekprem(?:\s+(\d+))?$/i, (msg, match) => {
  const chatId = msg.chat.id;
  const targetId = match[1] || msg.from.id;
  const user = ensureUserRecord(targetId);

  if (!user.isPremium || !isPremiumActive(user))
    return bot.sendMessage(chatId, `<blockquote>🚫 User ID <code>${targetId}</code> bukan premium atau sudah expired.</blockquote>`, {
    parse_mode: "HTML"
    });

  const now = new Date();
  const expire = new Date(user.premiumUntil);

  let tahun = expire.getFullYear() - now.getFullYear();
  let bulan = expire.getMonth() - now.getMonth();
  let hari = expire.getDate() - now.getDate();
  let jam = expire.getHours() - now.getHours();
  let menit = expire.getMinutes() - now.getMinutes();

  if (menit < 0) {
    menit += 60;
    jam -= 1;
  }
  if (jam < 0) {
    jam += 24;
    hari -= 1;
  }

  if (hari < 0) {
    const prevMonth = new Date(expire.getFullYear(), expire.getMonth(), 0);
    hari += prevMonth.getDate();
    bulan -= 1;
  }

  if (bulan < 0) {
    bulan += 12;
    tahun -= 1;
  }

  const parts = [];
  if (tahun > 0) parts.push(`${tahun} tahun`);
  if (bulan > 0) parts.push(`${bulan} bulan`);
  if (hari > 0) parts.push(`${hari} hari`);
  if (jam > 0) parts.push(`${jam} jam`);
  if (menit > 0) parts.push(`${menit} menit`);

  const sisaText = parts.length ? parts.join(' ') : 'kurang dari 1 menit';

  bot.sendMessage(chatId, `<blockquote>⭐ User ID: <code>${targetId}</code>
Masih aktif selama: ${sisaText}
📅 Berakhir: ${expire.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</blockquote>`, {
    parse_mode: "HTML"
  });
});

bot.onText(/^\/info$/i, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  let db = JSON.parse(fs.readFileSync("./database/users.json", "utf8"));
  const user = db[userId] || { count: 0, role: "Pemula" };

  resetWeeklyIfNeeded(user);
  db[userId] = user;
  fs.writeFileSync("./database/users.json", JSON.stringify(db, null, 2));

  const isPremium = user.isPremium || false;
  const baseLimit = 3;
  const limitGacha = isPremium ? "∞" : baseLimit + (user.extraLimit || 0);
  const totalGacha = user.count || 0;
  const sisaGacha = isPremium ? "Tanpa batas" : limitGacha - totalGacha;

  const now = new Date();
  const nextReset = new Date(now);
  const diff = (5 - now.getDay() + 7) % 7 || 7;
  nextReset.setDate(now.getDate() + diff);
  nextReset.setHours(0, 0, 0, 0);

  const hariList = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulanList = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const tglReset = `${hariList[nextReset.getDay()]}, ${nextReset.getDate()} ${bulanList[nextReset.getMonth()]} ${nextReset.getFullYear()}`;

  const text = `<blockquote>📊 Info Gacha Kamu

🆔 ID: <code>${userId}</code>
⭐ Status: ${isPremium ? "👑 Premium" : "👤 Free"}
🎲 Total Gacha Minggu Ini: ${totalGacha}/${isPremium ? "∞" : limitGacha}
💫 Sisa Gacha: ${sisaGacha}
🔁 Reset Mingguan: ${tglReset}
</blockquote>`;

  bot.sendMessage(chatId, text, { parse_mode: "HTML" });
});

bot.onText(/^\/pengumuman(?:\s+([\s\S]+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const text = match[1]?.trim();

  const ownerList = Array.isArray(OWNER) ? OWNER : [OWNER];
  if (!ownerList.includes(senderId)) {
    return bot.sendMessage(chatId, `<blockquote>🚫 Hanya owner yang bisa mengirim pengumuman.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  if (!text) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Gunakan format:\n\n<code>/pengumuman isi pesanmu</code></blockquote>`, {
      parse_mode: "HTML"
    });
  }

  try {
    const users = JSON.parse(fs.readFileSync("./database/users.json"));
    let success = 0, failed = 0;

    bot.sendMessage(chatId, `<blockquote>📢 Mengirim pengumuman ke semua user...</blockquote>`, {
    parse_mode: "HTML"
    });

    for (const id in users) {
      try {
        await bot.sendMessage(id, `<blockquote>📣 Pengumuman!\n\n${text}</blockquote>`, {
        parse_mode: "HTML"
        });
        success++;
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        failed++;
        console.log(`[PENGUMUMAN] Gagal kirim ke ${id}: ${err.message}`);
      }
    }

    bot.sendMessage(chatId, `<blockquote>✅ Pengumuman selesai dikirim!\n\n🟢 Berhasil: ${success}\n🔴 Gagal: ${failed}</blockquote>`, {
      parse_mode: "HTML"
    });

  } catch (err) {
    console.error("Error pengumuman:", err);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat mengirim pengumuman.");
  }
});

bot.onText(/^\/addadmin\s+(\d+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const ownerId = msg.from.id;

  if (ownerId !== OWNER)
    return bot.sendMessage(chatId, `<blockquote>🚫 Hanya owner yang bisa menambahkan admin bot!</blockquote>`, { parse_mode: "HTML" });

  const targetId = Number(match[1]);

  if (ADMIN_BOT_IDS.includes(targetId))
    return bot.sendMessage(chatId, `<blockquote>⚠️ User ${targetId} sudah jadi admin bot.</blockquote>`, {
    parse_mode: "HTML"
  });

  ADMIN_BOT_IDS.push(targetId);
  saveAdmins(ADMIN_BOT_IDS);

  await bot.sendMessage(chatId, `<blockquote>✅ User ${targetId} sekarang jadi admin bot (bisa jual/bagi limit).</blockquote>`, {
    parse_mode: "HTML"
  });

  try {
    await bot.sendMessage(targetId, `<blockquote>📢 Kamu baru saja dijadikan <b>Admin Bot</b> oleh owner!\n\n💎 Sekarang kamu bisa:\n• Kirim limit ke user lain\n• Jual limit premium\n• Akses fitur admin premium\n\nGunakan command <code>/send [user_id] [jumlah]</code> untuk mengirim limit.</blockquote>`, {
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("Gagal kirim pesan ke admin baru:", err.message);
    bot.sendMessage(chatId, `<blockquote>⚠️ Gagal kirim pesan ke user (mungkin belum pernah chat bot).</blockquote>`, {
      parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/deladmin\s+(\d+)$/i, (msg, match) => {
  const chatId = msg.chat.id;
  const ownerId = msg.from.id;

  if (ownerId !== OWNER)
    return bot.sendMessage(chatId, `<blockquote>🚫 Hanya owner yang bisa hapus admin bot!</blockquote>`, {
    parse_mode: "HTML"
    });

  const targetId = Number(match[1]);
  const idx = ADMIN_BOT_IDS.indexOf(targetId);

  if (idx === -1)
    return bot.sendMessage(chatId, `<blockquote>⚠️ User ${targetId} bukan admin bot.</blockquote>`, {
    parse_mode: "HTML"
  });

  ADMIN_BOT_IDS.splice(idx, 1);
  saveAdmins(ADMIN_BOT_IDS);

  bot.sendMessage(chatId, `<blockquote>❌ User ${targetId} sudah dihapus dari admin bot.</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.onText(/^\/listadmin$/i, (msg) => {
  const chatId = msg.chat.id;
  const ownerId = msg.from.id;

  if (ownerId !== OWNER)
    return bot.sendMessage(chatId, `<blockquote>🚫 Hanya owner yang bisa melihat daftar admin bot!</blockquote>`, {
    parse_mode: "HTML"
    });

  if (ADMIN_BOT_IDS.length === 0)
    return bot.sendMessage(chatId, `<blockquote>📭 Belum ada admin bot yang terdaftar.</blockquote>`, {
    parse_mode: "HTML"
  });

  const list = ADMIN_BOT_IDS.map((id, i) => `${i + 1}. <code>${id}</code>`).join("\n");
  bot.sendMessage(chatId, `<blockquote><b>📜 Daftar Admin Bot:</b>\n\n${list}</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.onText(/^\/send\s+(\d+)\s+(\d+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetId = Number(match[1]);
  const jumlahLimit = parseInt(match[2]);

  if (maintenanceCheck(bot, msg, chatId)) return;

  const sender = ensureUserRecord(senderId);
  const target = ensureUserRecord(targetId);

  let isPremium = false;
  if (sender.isPremium && sender.premiumUntil) {
    const now = new Date();
    const expire = new Date(sender.premiumUntil);
    if (expire > now) {
      isPremium = true;
    } else {
      sender.isPremium = false;
      sender.premiumUntil = null;
      saveUsers();
    }
  }

  const isAdminBot = ADMIN_BOT_IDS.includes(senderId);

  if (isPremium && !isAdminBot) {
    return bot.sendMessage(chatId, `<blockquote>🚫 Kamu premium, tapi belum jadi admin bot.
Kamu tidak bisa kirim limit ke orang lain sebelum owner menambahkan kamu jadi admin bot.</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  if (!isPremium && !isAdminBot) {
    if ((sender.extraLimit || 0) < jumlahLimit) {
      return bot.sendMessage(chatId, `<blockquote>🚫 Limit kamu tidak cukup! Sisa: ${sender.extraLimit || 0}</blockquote>`, {
        parse_mode: "HTML"
      });
    }

    sender.extraLimit -= jumlahLimit;
    target.extraLimit = (target.extraLimit || 0) + jumlahLimit;
    saveUsers();

    bot.sendMessage(chatId, `<blockquote>✅ Kamu berhasil kirim ${jumlahLimit} limit ke user ${targetId}.</blockquote>`, { parse_mode: "HTML" });
    return bot.sendMessage(targetId, `<blockquote>🎁 Kamu menerima ${jumlahLimit} limit dari user ${senderId}!</blockquote>`, { parse_mode: "HTML" });
  }

  if (isPremium && isAdminBot) {
    target.extraLimit = (target.extraLimit || 0) + jumlahLimit;
    saveUsers();

    bot.sendMessage(chatId, `<blockquote>💎 Kamu (admin premium) berhasil kirim ${jumlahLimit} limit ke user ${targetId} tanpa batas!</blockquote>`, {
      parse_mode: "HTML"
    });

    return bot.sendMessage(targetId, `<blockquote>🎁 Admin Premium mengirim ${jumlahLimit} limit ke kamu!</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  if (!isPremium && isAdminBot) {
    if ((sender.extraLimit || 0) < jumlahLimit)
      return bot.sendMessage(chatId, `<blockquote>🚫 Limit kamu tidak cukup! Sisa: ${sender.extraLimit || 0}</blockquote>`, { parse_mode: "HTML" });

    sender.extraLimit -= jumlahLimit;
    target.extraLimit = (target.extraLimit || 0) + jumlahLimit;
    saveUsers();

    bot.sendMessage(chatId, `<blockquote>🧩 Kamu (admin biasa) berhasil kirim ${jumlahLimit} limit ke user ${targetId}.</blockquote>`, {
      parse_mode: "HTML"
    });

    return bot.sendMessage(targetId, `<blockquote>🎁 Kamu menerima ${jumlahLimit} limit dari admin ${senderId}!</blockquote>`, {
      parse_mode: "HTML"
    });
  }
});

//===================== GROUP =====================

bot.onText(/^\/jasher(?:\s+(.+))?/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const textBroadcast = match[1];
  const text = match[1];
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  if (!text) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Contoh penggunaan:\n\n<code>/jasher Aku lucu banget 😜</code></blockquote>`, {
      parse_mode: "HTML"
    });
  }
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", 
      reply_markup: { 
      inline_keyboard: 
        [
          [
            { 
              text: "📢 Channel Official", 
              url: CHANNEL_LINK 
            }
          ]
        ] 
      }
    });
  }
    
  if (!fs.existsSync(groupsFile)) {
    return bot.sendMessage(chatId, `<blockquote>Belum ada grup terdaftar untuk menerima broadcast, Tambahkan bot ke dalam group.</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  const groups = JSON.parse(fs.readFileSync(groupsFile, "utf8"));
  if (!Array.isArray(groups) || !groups.length) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Tidak ada grup tersimpan untuk broadcast.</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  bot.tempBroadcast = {
    text: textBroadcast,
    userId: msg.from.id,
    stage: "askPhoto",
  };

  await bot.sendMessage(chatId, `<blockquote>🖼️ Apakah kamu ingin menambahkan foto ke broadcast ini?</blockquote>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Iya", callback_data: "broadcast_yes" },
          { text: "❌ Tidak", callback_data: "broadcast_no" },
        ],
      ],
    },
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!bot.tempBroadcast || query.from.id !== bot.tempBroadcast.userId) {
    return bot.answerCallbackQuery(query.id, { text: "Perintah ini tidak untukmu." });
  }

  const { text } = bot.tempBroadcast;
  const groups = JSON.parse(fs.readFileSync(groupsFile, "utf8"));

  if (data === "broadcast_yes") {
    bot.tempBroadcast.stage = "waitingPhoto";
    await bot.sendMessage(chatId, `<blockquote>📸 Kirimkan foto yang ingin kamu sertakan dalam broadcast ini.</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  if (data === "broadcast_no") {
    await bot.sendMessage(chatId, `<blockquote>📢 Mengirim broadcast ke ${groups.length} grup...</blockquote>`, {
      parse_mode: "HTML",
    });

    let success = 0;
    for (const groupId of groups) {
      try {
        await bot.sendMessage(groupId, `<blockquote>${bot.tempBroadcast.text}</blockquote>`, {
          parse_mode: "HTML",
        });
        success++;
      } catch (err) {
        console.log(`⚠️ Gagal kirim ke grup ${groupId}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    bot.sendMessage(chatId, `<blockquote>✅ Broadcast selesai!\nBerhasil dikirim ke ${success}/${groups.length} grup.</blockquote>`, {
      parse_mode: "HTML",
    });

    delete bot.tempBroadcast;
  }
});

bot.on("photo", async (msg) => {
  if (!bot.tempBroadcast || bot.tempBroadcast.stage !== "waitingPhoto") return;
  if (msg.from.id !== bot.tempBroadcast.userId) return;

  const chatId = msg.chat.id;
  const photoId = msg.photo[msg.photo.length - 1].file_id;
  const text = bot.tempBroadcast.text;
  const groups = JSON.parse(fs.readFileSync(groupsFile, "utf8"));

  await bot.sendMessage(chatId, `<blockquote>📢 Mengirim broadcast teks + foto ke ${groups.length} grup...</blockquote>`, {
    parse_mode: "HTML",
  });

  let success = 0;
  for (const groupId of groups) {
    try {
      await bot.sendPhoto(groupId, photoId, {
        caption: `<blockquote>${text}</blockquote>`,
        parse_mode: "HTML",
      });
      success++;
    } catch (err) {
      console.log(`⚠️ Gagal kirim ke grup ${groupId}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  bot.sendMessage(chatId, `<blockquote>✅ Broadcast teks + foto selesai!\nBerhasil dikirim ke ${success}/${groups.length} grup.</blockquote>`, {
    parse_mode: "HTML",
  });

  delete bot.tempBroadcast;
});

bot.on("message", (msg) => {
  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    try {
      let groups = [];
      if (fs.existsSync(groupsFile)) {
        groups = JSON.parse(fs.readFileSync(groupsFile, "utf8"));
      }

      if (!Array.isArray(groups)) groups = [];
      if (!groups.includes(msg.chat.id)) {
        groups.push(msg.chat.id);
        fs.writeFileSync(groupsFile, JSON.stringify(groups, null, 2));
        console.log(`✅ Grup baru disimpan: ${msg.chat.title} (${msg.chat.id})`);
      }
    } catch (err) {
      console.error("❌ Gagal menyimpan grup:", err.message);
    }
  }
});

bot.onText(/^\/brat(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  if (!text) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Contoh penggunaan:\n\n<code>/brat Aku lucu banget 😜</code></blockquote>`, {
      parse_mode: "HTML"
    });
  }

  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
    
  await bot.sendMessage(
    chatId,
    `<blockquote>⚙️ Membuat stiker dari teks: ${text}</blockquote>`,
    { parse_mode: "HTML" }
  );

  try {
    const response = await axios.post(
      "https://api.siputzx.my.id/api/m/brat",
      {
        text,
        isAnimated: false,
        delay: 100,
      },
      { responseType: "arraybuffer" }
    );

    const contentType = response.headers["content-type"];
    const buffer = Buffer.from(response.data);

    if (contentType.startsWith("image/")) {
      try {
        const webpBuffer = await sharp(buffer)
          .resize(512, 512, { fit: "inside" })
          .webp({ quality: 95 })
          .toBuffer();

        await bot.sendSticker(chatId, webpBuffer);

        const fileName = `brat_${Date.now()}.webp`;
        fs.writeFileSync(path.join(stickerDir, fileName), webpBuffer);

        await bot.sendMessage(
          chatId,
          `<blockquote>✅ Stiker berhasil dibuat!\n📁 Disimpan di: <code>stickers/${fileName}</code></blockquote>`,
          { parse_mode: "HTML" }
        );
      } catch (e) {
        console.error("❌ Gagal kirim sebagai stiker:", e.message);
        await bot.sendPhoto(chatId, buffer, {
          caption: `🖼️ Gagal kirim stiker, dikirim sebagai foto.`,
          parse_mode: "HTML",
        });
      }
    } else if (contentType.startsWith("video/")) {
      await bot.sendVideo(chatId, buffer, {
        caption: `🎬 Animasi brat dari teks: ${text}`,
        parse_mode: "HTML",
      });
    } else {
      await bot.sendMessage(
        chatId,
        `<blockquote>⚠️ Format tidak diketahui, tidak bisa dikirim.</blockquote>`,
        { parse_mode: "HTML" }
      );
    }
  } catch (err) {
    console.error("Error /brat:", err);
    await bot.sendMessage(
      chatId,
      `<blockquote>❌ Gagal memproses: ${err.message}</blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/^\/iqc(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  if (!text) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Contoh penggunaan:\n\n<code>/iqc Aku lucu banget 😜</code></blockquote>`, {
      parse_mode: "HTML"
    });
  }
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
    
  await bot.sendMessage(
    chatId,
    `<blockquote>⚙️ Membuat gambar IQC dari teks: ${text}</blockquote>`,
    { parse_mode: "HTML" }
  );

  try {
    const apiUrl = `https://api.betabotz.eu.org/api/maker/iqc?text=${encodeURIComponent(
      text
    )}&apikey=${APIKEY}`;

    const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
    const contentType = response.headers["content-type"];
    const buffer = Buffer.from(response.data);

    if (contentType.startsWith("image/")) {
      await bot.sendPhoto(chatId, buffer, {
        caption: `<blockquote>✅ Gambar IQC berhasil dibuat dari teks: ${text}</blockquote>`,
        parse_mode: "HTML",
      });
    } else {
      await bot.sendMessage(chatId, `<blockquote>⚠️ Format file tidak dikenali.</blockquote>`, {
        parse_mode: "HTML",
      });
    }
  } catch (err) {
    console.error(err);
    await bot.sendMessage(
      chatId,
      `<blockquote>❌ Gagal memproses: ${err.message}</blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/^\/play(?:@[\w_]+)?\s*(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;  
    const searchText = match[1]?.trim();
    
    if (maintenanceCheck(bot, msg, chatId)) return;
    
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
    
    if (!searchText) {
        return bot.sendMessage(chatId, `<blockquote>❗ Contoh:\n/play komang</blockquote>`, { 
        parse_mode: "HTML" 
        });
    }

    await bot.sendMessage(chatId, `<blockquote>🔍 Mencari lagu...</blockquote>`, {
        parse_mode: "HTML"
        });

    try {

        const search = await yts(searchText);
        const video = search.videos[0];
        if (!video) return bot.sendMessage(chatId, `<blockquote>❌ Lagu tidak ditemukan.</blockquote>`);


        const res = await axios.get(`https://api.betabotz.eu.org/api/download/ytmp3`, {
            params: {
                url: video.url,
                apikey: APIKEY
            }
        });

        const data = res.data;
        if (!data.status) return bot.sendMessage(chatId, "❌ Gagal download lagu.");

 
        const mp3Url = data.result.mp3;
        const safeTitle = video.title.replace(/[<>:"/\\|?*]+/g, ''); 
        const filePath = path.join(__dirname, `${safeTitle}.mp3`);
        const audioRes = await axios.get(mp3Url, { responseType: 'arraybuffer' });
        fs.writeFileSync(filePath, audioRes.data);

 
        await bot.sendAudio(chatId, fs.createReadStream(filePath), {
            title: video.title,
            performer: video.author.name
        });

 
        fs.unlinkSync(filePath);

    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, `<blockquote>⚠️ Terjadi kesalahan saat memproses permintaan.</blockquote>`, {
        parse_mode: "HTML"
        });
    }
});

bot.onText(/^\/tiktok(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const url = match[1];
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
  
  if (!url) {
    return bot.sendMessage(chatId, `<blockquote>☘️ Link TikTok-nya Mana?</blockquote>`, { 
    parse_mode: "HTML" 
    });
  }

 
  const urlRegex = /^(https?:\/\/)?([\w.-]+)+(:\d+)?(\/\S*)?$/;
  if (!urlRegex.test(url)) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Itu Bukan Link Yang Benar</blockquote>`, { 
    parse_mode: "HTML" 
    });
  }

  bot.sendMessage(chatId, `<blockquote>⏳ Tunggu sebentar, sedang mengambil video...</blockquote>`, {
        parse_mode: "HTML"
        });

  try {
  const res = await tiktok(url);

 
  let caption = `🎬 Judul: ${res.title}`;
     if (caption.length > 1020) {
     caption = caption.substring(0, 1017) + "...";
  }

await bot.sendVideo(chatId, res.no_watermark, { caption });
 
  if (res.music && res.music.trim() !== "") {
    await bot.sendAudio(chatId, res.music, { title: "tiktok_audio.mp3" });
  } else {
    await bot.sendMessage(chatId, `<blockquote>🎵 Video ini tidak memiliki audio asli.</blockquote>`, {
        parse_mode: "HTML"
        });
  }

} catch (error) {
  console.error(error);
  bot.sendMessage(chatId, `<blockquote>⚠️ Terjadi kesalahan saat mengambil video TikTok. Coba lagi nanti.</blockquote>`, {
        parse_mode: "HTML"
        });
}
});

bot.onText(/^\/youtube(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match[1] || (msg.reply_to_message && (msg.reply_to_message.text || ''));

  if (maintenanceCheck(bot, msg, chatId)) return;

  const member = await bot.getChatMember(CHANNEL_ID, userId);
  if (member.status === 'left' || member.status === 'kicked') {
    return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
    });
  }

  const url = extractUrl(input);
  if (!url) {
    return bot.sendMessage(chatId, '<blockquote>❌ Contoh penggunaan:\n/youtube https://youtu.be/IDVIDEO\natau balas pesan yang berisi link YouTube dengan /youtube</blockquote>', {
    parse_mode: 'HTML'
    });
  }

  const loading = await bot.sendMessage(chatId, `<blockquote>🔎 Sedang memproses video... Mohon tunggu sebentar.</blockquote>`, {
  parse_mode: "HTML"
  });

  try {
    const api = `https://api.betabotz.eu.org/api/download/ytmp3?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(APIKEY)}`;
    const res = await axios.get(api, { timeout: 120000 });
    const data = res.data;

    if (!data?.status || !data.result) {
      await bot.sendMessage(chatId, `<blockquote>❌ Gagal mengambil data dari API. Coba lagi nanti.</blockquote>`, {
      parse_mode: "HTML"
      });
      return bot.deleteMessage(chatId, loading.message_id);
    }

    const result = data.result;
    const title = result.title || 'Tanpa Judul';
    const thumb = result.thumb;
    const mp3Url = result.mp3;
    const duration = result.duration ? `<blockquote>⏱️ Durasi: ${result.duration}</blockquote>` : '';
    const caption = `<blockquote>🎵 ${escapeHtml(title)}\n${duration}</blockquote>`;

    if (thumb) {
      try {
        await bot.sendPhoto(chatId, thumb, {
          caption,
          parse_mode: 'HTML'
        });
      } catch (e) {
        console.log('Gagal kirim thumbnail:', e.message);
      }
    }
    
    if (mp3Url) {
      const filePath = path.join(__dirname, `${sanitizeFilename(title)}.mp3`);
      const writer = fs.createWriteStream(filePath);

      const response = await axios({
        url: mp3Url,
        method: 'GET',
        responseType: 'stream',
        timeout: 90000
      });

      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await bot.sendAudio(chatId, filePath, {
        caption: `<blockquote>🎧 ${escapeHtml(title)}</blockquote>`,
        parse_mode: 'HTML'
      });

      fs.unlinkSync(filePath);
    } else {
      await bot.sendMessage(chatId, `<blockquote>❌ Tidak ada file MP3 yang bisa diunduh.</blockquote>`, {
      parse_mode: "HTML"
      });
    }

  } catch (err) {
    console.error('Error YouTube:', err.response?.data || err.message);
    await bot.sendMessage(chatId, `<blockquote>❌ Gagal memproses YouTube:\n<code>${escapeHtml(err.message || 'Tidak diketahui')}</code></blockquote>`, {
    parse_mode: 'HTML'
    });
  } finally {
    try { await bot.deleteMessage(chatId, loading.message_id); } catch (_) {}
  }
});

bot.onText(/^\/cariyoutube(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1] || (msg.reply_to_message && msg.reply_to_message.text);

  if (maintenanceCheck(bot, msg, chatId)) return;

  if (!query) {
    return bot.sendMessage(chatId, `<blockquote>❌ Contoh:\n/cariyoutube dalinda</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  const loading = await bot.sendMessage(chatId, `<blockquote>🔎 Mencari: ${query}</blockquote>`, {
  parse_mode: "HTML"
  });

  try {
    const searchUrl = `https://api.betabotz.eu.org/api/search/yts?query=${encodeURIComponent(query)}&apikey=${APIKEY}`;
    const searchRes = await axios.get(searchUrl, { timeout: 30000 });
    const vid = searchRes.data?.result?.[0];
    if (!vid) throw new Error("Tidak ditemukan hasil.");

    const dlUrl = `https://api.betabotz.eu.org/api/download/ytmp3?url=${encodeURIComponent(vid.url)}&apikey=${APIKEY}`;
    const dlRes = await axios.get(dlUrl, { timeout: 60000 });
    const mp3Url = dlRes.data?.result?.mp3;
    if (!mp3Url) throw new Error("Tidak dapat mengambil link MP3.");

    const caption = 
`<blockquote>🎵 ${escapeHtml(vid.title)}
⏱️ Durasi: ${escapeHtml(vid.duration || "-")}
📅 Terbit: ${escapeHtml(vid.published_at)}
👀 Views: ${escapeHtml(vid.views)}
📺 <a href="${vid.url}">Tonton di YouTube</a></blockquote>`;

    try {
      await bot.sendPhoto(chatId, vid.thumbnail, {
        caption,
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
    } catch {
      await bot.sendMessage(chatId, caption, { parse_mode: "HTML" });
    }

    const audioResponse = await axios.get(mp3Url, { responseType: "arraybuffer", timeout: 60000 });
    const audioBuffer = Buffer.from(audioResponse.data, "binary");

    await bot.sendAudio(chatId, audioBuffer, {
      filename: `${sanitizeFilename(vid.title)}.mp3`,
      title: vid.title,
      performer: vid.author?.name || "YouTube",
      caption: `<blockquote>🎧 ${escapeHtml(vid.title)}
⏱️ Durasi: ${escapeHtml(vid.duration || "-")}
📅 Terbit: ${escapeHtml(vid.published_at)}
👀 Views: ${escapeHtml(vid.views)}</blockquote>`,
      parse_mode: "HTML"
    });

  } catch (err) {
    console.error("Error /cariyoutube:", err.message);
    await bot.sendMessage(chatId, `<blockquote>❌ Gagal memproses:\n<code>${escapeHtml(err.message)}</code></blockquote>`, { parse_mode: "HTML" });
  } finally {
    try { await bot.deleteMessage(chatId, loading.message_id); } catch (_) {}
  }
});

bot.onText(/\/hytamkan/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
  if (!msg.reply_to_message || !msg.reply_to_message.photo) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Reply foto dengan caption /hytamkan</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  bot.sendMessage(chatId, `<blockquote>⏱️ Sedang memproses...</blockquote>`, {
    parse_mode: "HTML"
    });

  try {
    const fileId = msg.reply_to_message.photo.pop().file_id;
    const file = await bot.getFile(fileId);

    const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64Image = buffer.toString("base64");

    const genAI = new GoogleGenerativeAI("AIzaSyDoMqqCBjo5wF4YLVnIJTX3h1hISR6NPKo"); // ganti API key
    const promptText =
      "Ubahlah Karakter Dari Gambar Tersebut Diubah Kulitnya Menjadi Hitam se hitam-hitam nya";

    const contents = [
      { text: promptText },
      { inlineData: { mimeType: "image/jpeg", data: base64Image } },
    ];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: { responseModalities: ["Text", "Image"] },
    });

    const result = await model.generateContent(contents);

    let resultImage;
    for (const part of result.response.candidates[0].content.parts) {
      if (part.inlineData) {
        resultImage = Buffer.from(part.inlineData.data, "base64");
      }
    }

    if (resultImage) {
      const tempPath = `./hytam_${Date.now()}.png`;
      fs.writeFileSync(tempPath, resultImage);

      await bot.sendPhoto(chatId, tempPath, {
        caption: `<blockquote>✅ berhasil menghitamkan</blockquote>`,
        parse_mode: "HTML",
      });

      setTimeout(() => {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }, 30000);
    } else {
      bot.sendMessage(chatId, `<blockquote>❌ Gagal memproses gambar.</blockquote>`, {
    parse_mode: "HTML"
    });
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, `<blockquote>⚠️ Error: ${error.message}</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cecan(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const negara = (match[1] || "").toLowerCase().trim();
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  const member = await bot.getChatMember(CHANNEL_ID, userId);
  if (member.status === "left" || member.status === "kicked") {
    return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]],
      },
    });
  }

  const listNegara = [
    "china", "vietnam", "thailand", "indonesia", "korea",
    "japan", "malaysia", "justinaxie", "jeni", "jiso",
    "ryujin", "rose", "hijaber"
  ];

  if (!negara) {
    return bot.sendMessage(chatId, 
      `<blockquote>🌏 Pilih kategori cecan:\n\n${listNegara.map(n => `• <code>${n}</code>`).join('\n')}\n\nContoh: <code>/cecan korea</code></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  if (!listNegara.includes(negara)) {
    return bot.sendMessage(chatId, 
      `<blockquote>❌ Kategori tidak ditemukan.\nGunakan salah satu:\n${listNegara.map(n => `• <code>${n}</code>`).join('\n')}</blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  const loading = await bot.sendMessage(chatId, `<blockquote>🖼️ Mengambil foto cecan ${negara}...</blockquote>`, { parse_mode: "HTML" });

  try {
    const apiUrl = `https://api.betabotz.eu.org/api/cecan/${negara}?apikey=${APIKEY}`;
    const res = await axios.get(apiUrl, { responseType: "arraybuffer", timeout: 20000 });

    await bot.sendPhoto(chatId, Buffer.from(res.data), {
      caption: `<blockquote>🌸 Cecan ${negara.charAt(0).toUpperCase() + negara.slice(1)} 😍</blockquote>`,
      parse_mode: "HTML",
    });

  } catch (err) {
    console.error("/cecan error:", err.message);
    await bot.sendMessage(chatId,
      `<blockquote>❌ Gagal mengambil foto:\n<code>${escapeHtml(err.message)}</code></blockquote>`,
      { parse_mode: "HTML" }
    );
  } finally {
    try { await bot.deleteMessage(chatId, loading.message_id); } catch (_) {}
  }
});

//===================== TOOLS =====================

bot.onText(/\/id(?:\s+(@\w+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  let targetUser = msg.from;
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  try {
    if (msg.reply_to_message) {
      targetUser = msg.reply_to_message.from;
    }

    else if (match[1]) {
      const username = match[1].replace('@', '');
      const members = await bot.getChatAdministrators(chatId);
      const found = members.find(m => m.user.username?.toLowerCase() === username.toLowerCase());

      if (found) {
        targetUser = found.user;
      } else {
        return bot.sendMessage(
          chatId,
          `<blockquote>❌ Tidak dapat menemukan info dari @${username}</blockquote>`,
          { parse_mode: "HTML" }
        );
      }
    }

    const userId = targetUser.id.toString();
    const name = targetUser.first_name
      ? escapeHtml(targetUser.first_name)
      : "-";
    const username = targetUser.username
      ? `@${escapeHtml(targetUser.username)}`
      : "-";
    const language = targetUser.language_code || "-";
    const userLink = `<a href="tg://user?id=${userId}">Klik di sini</a>`;

    const text = `<blockquote>👤 Informasi Pengguna:
• Nama     : ${name}
• Username : ${username}
• ID       : <code>${userId}</code>
• Bahasa   : ${language}
• User Link: ${userLink}</blockquote>`;

    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Error /id command:", err);
    bot.sendMessage(chatId, `<blockquote>⚠️ Terjadi kesalahan saat mengambil data pengguna.</blockquote>`, {
      parse_mode: "HTML",
    });
  }
});

bot.onText(/\/hacknik (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const nik = match[1];
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }

  if (!/^\d{16}$/.test(nik)) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Format NIK tidak valid! Harus 16 digit angka.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  try {
    const response = await axios.get(`https://api.siputzx.my.id/api/tools/nik-checker?nik=${nik}`);
    const data = response.data;

    if (!data.status || !data.data || data.data.status !== "success") {
      return bot.sendMessage(chatId, `<blockquote>❌ Data tidak ditemukan atau terjadi kesalahan pada server.</blockquote>`, {
      parse_mode: "HTML"
      });
    }

    const d = data.data.data;
    const text = `<blockquote> 𝗖𝗘𝗞 𝗡𝗜𝗞 𝗗𝗢𝗡𝗘 𝗕𝗔𝗡𝗚
👤 ${d.nama}
${d.kelamin === "PEREMPUAN" ? "♀️" : "♂️"} ${d.kelamin}
📅 Tanggal Lahir: ${d.tempat_lahir}
🎂 Usia: ${d.usia}
🏠 Alamat: ${d.alamat}
🏘️ Kelurahan: ${d.kelurahan}
🏞️ Kecamatan: ${d.kecamatan}
🏛️ Kabupaten: ${d.kabupaten}
🌍 Provinsi: ${d.provinsi}
🗳️ TPS: ${d.tps}
♎ Zodiak: ${d.zodiak}
📆 Ulang Tahun Berikutnya: ${d.ultah_mendatang}
📌 Koordinat: ${d.koordinat.lat}, ${d.koordinat.lon}
</blockquote>`;

    bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Error cek NIK:", err.message);
    bot.sendMessage(chatId, "⚠️ Gagal mengambil data dari server!");
  }
});

bot.onText(/\/get (.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!/^https?:\/\//.test(url))
    return bot.sendMessage(chatId, `<blockquote>Ex: /get https://angkasa.my.id</blockquote>`, {
      parse_mode: "HTML"
    });

  bot.sendMessage(chatId, `<blockquote>⚡ Mengambil semua file & folder dari URL...</blockquote>`, {
    parse_mode: "HTML"
  });

  try {
    const res = await fetch(url);
    const html = await res.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const baseUrl = new URL(url);

    const assets = new Set();
    document.querySelectorAll("link[href], script[src], img[src]").forEach(el => {
      const attr = el.getAttribute("href") || el.getAttribute("src");
      if (attr && !attr.startsWith("data:")) {
        try {
          const fullUrl = new URL(attr, baseUrl).href;
          assets.add(fullUrl);
        } catch {}
      }
    });

    const folder = path.join(__dirname, `temp_${Date.now()}`);
    fs.mkdirSync(folder, { recursive: true });

    fs.writeFileSync(path.join(folder, "index.html"), html);

    let count = 0;
    for (const assetUrl of assets) {
      try {
        const relativePath = assetUrl.replace(baseUrl.origin, "");
        const filePath = path.join(folder, relativePath);
        const dirPath = path.dirname(filePath);
        fs.mkdirSync(dirPath, { recursive: true });

        const resp = await fetch(assetUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const buffer = await resp.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        count++;
      } catch (err) {
        console.log("Gagal ambil:", assetUrl, err.message);
      }
    }

    const zip = new AdmZip();
    zip.addLocalFolder(folder);
    const zipPath = `${folder}.zip`;
    zip.writeZip(zipPath);

    await bot.sendDocument(chatId, zipPath, { caption: `📦 Semua file (${count} asset) + struktur folder berhasil diambil!` });

    fs.rmSync(folder, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, `❌ Gagal mengambil file: ${err.message || err}`);
  }
});

bot.onText(/\/tourl/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id; 
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
    
  const replyMsg = msg.reply_to_message;
  if (!replyMsg) {
    return bot.sendMessage(chatId, `<blockquote>❌ Balas sebuah pesan yang berisi file/audio/video dengan perintah /tourl2.</blockquote>`, {
    parse_mode: "HTML"
  });
  }

  if (!replyMsg.document && !replyMsg.photo && !replyMsg.video && !replyMsg.audio && !replyMsg.voice) {
    return bot.sendMessage(chatId,`<blockquote>❌ Pesan yang kamu balas tidak mengandung file/audio/video yang bisa diupload.</blockquote>`, {
    parse_mode: "HTML"
  });
  }

  try {
    let fileId, filename;

    if (replyMsg.document) {
      fileId = replyMsg.document.file_id;
      filename = replyMsg.document.file_name;
    } else if (replyMsg.photo) {
      const photoArray = replyMsg.photo;
      fileId = photoArray[photoArray.length - 1].file_id;
      filename = 'photo.jpg';
    } else if (replyMsg.video) {
      fileId = replyMsg.video.file_id;
      filename = replyMsg.video.file_name || 'video.mp4';
    } else if (replyMsg.audio) {
      fileId = replyMsg.audio.file_id;
      filename = replyMsg.audio.file_name || 'audio.mp3';
    } else if (replyMsg.voice) {
      fileId = replyMsg.voice.file_id;
      filename = 'voice.ogg';
    }

    const fileLink = await bot.getFileLink(fileId);
    const response = await fetch(fileLink);
    const fileBuffer = Buffer.from(await response.arrayBuffer());

    const catboxUrl = await uploadToCatbox(fileBuffer, filename);

    bot.sendMessage(chatId, `<blockquote>✅ File berhasil diupload ke Catbox:\n${catboxUrl}</blockquote>`, {
    parse_mode: "HTML"
  });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, `<blockquote>❌ Gagal upload file: ${err.message}</blockquote>`, {
    parse_mode: "HTML"
  });
  }
});

bot.onText(/\/nglspam (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(" ");
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }
  
    if (args.length < 3) {
      return bot.sendMessage(
        chatId, `<blockquote>Format Salah!\n\nContoh: /ngl link text jumlah\n/ngl https://ngl.link/angkasa lu jelek 20 </blockquote>`, {
        parse_mode: 'HTML' 
        });
    }

    const link = args[0];
    const jumlah = parseInt(args[args.length - 1]);
    const pesan = args.slice(1, -1).join(" ");

    if (!/^https?:\/\/ngl\.link\//i.test(link)) {
      return bot.sendMessage(chatId, `<blockquote>❌ Link NGL tidak valid! Pastikan formatnya https://ngl.link/username</blockquote>`, {
        parse_mode: 'HTML' 
        });
    }

    if (isNaN(jumlah) || jumlah < 1 || jumlah > 200) {
      return bot.sendMessage(chatId, `<blockquote>❌ Jumlah pesan harus angka 1 - 100.</blockquote>`, {
        parse_mode: 'HTML' 
        });
    }

    try {
      const processingMsg = await bot.sendMessage(chatId, `<blockquote>⏳ Mengirim ${jumlah} pesan ke NGL...</blockquote>`, {
        parse_mode: 'HTML' 
        });

      const apiUrl = `https://api.siputzx.my.id/api/tools/ngl`;
      let success = 0, failed = 0;

      for (let i = 0; i < jumlah; i++) {
        try {
          await axios.post(apiUrl, {
            link: link,
            text: pesan
          }, { timeout: 10000 });

          success++;
          await new Promise(r => setTimeout(r, 1500));
        } catch {
          failed++;
        }
      }

      await bot.deleteMessage(chatId, processingMsg.message_id);

      await bot.sendMessage(
        chatId,
        `<blockquote>✅ Selesai Kirim Pesan NGL\n\n📩 Pesan: "${pesan}"\n📦 Total: ${jumlah}\n☑️ Berhasil: ${success}\n❌ Gagal: ${failed}</blockquote>`, {
        parse_mode: 'HTML' 
        });

    } catch (err) {
      console.error('[NGL ERROR]', err.message);
      bot.sendMessage(chatId, `<blockquote>❌ Gagal kirim ke NGL: ${err.message}</blockquote>`, {
        parse_mode: 'HTML' 
        });
    }
});

bot.onText(/^\/antishare(?:\s+(on|off))?$/i, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const senderId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, `<blockquote>❌ Perintah ini hanya bisa digunakan di grup.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  try {
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some((admin) => admin.user.id === senderId);
    if (!isAdmin) {
      return bot.sendMessage(chatId, `<blockquote>❌ Hanya admin grup yang bisa mengatur AntiShare.</blockquote>`, {
    parse_mode: "HTML"
    });
    }

    const status = match[1] ? match[1].toLowerCase() : null;

    if (status === "on") {
      antiforward[chatId] = true;
      fs.writeFileSync(dbAntiShare, JSON.stringify(antiforward, null, 2));
      return bot.sendMessage(chatId, `<blockquote>✅ Antishare aktif di grup ini.</blockquote>`, {
    parse_mode: "HTML"
    });
    } else if (status === "off") {
      delete antiforward[chatId];
      fs.writeFileSync(dbAntiShare, JSON.stringify(antiforward, null, 2));
      return bot.sendMessage(chatId, `<blockquote>✅ AntiShare dimatikan di grup ini.</blockquote>`, {
    parse_mode: "HTML"
    });
    } else {
      return bot.sendMessage(chatId, `<blockquote>📌 Gunakan:\n/antishare on\n/antishare off</blockquote>`, {
    parse_mode: "HTML"
    });
    }
  } catch (err) {
    console.error("[ANTISHARE CMD ERROR]", err);
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat mengatur AntiShare.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();

  if (antiforward[chatId]) {
    if (msg.forward_from || msg.forward_from_chat) {
      const admins = await bot.getChatAdministrators(chatId);
      const isAdmin = admins.some((admin) => admin.user.id === msg.from.id);

      if (!isAdmin) {
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          console.error("❌ Gagal hapus pesan forward:", e.message);
        }
      }
    }
  }
});

bot.onText(/^\/antilink(?:\s+(on|off))?$/i, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const senderId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  if (msg.chat.type === 'private') {
      return bot.sendMessage(chatId, `<blockquote>❌ Perintah ini hanya bisa digunakan di grup.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  try {
    
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(admin => admin.user.id === senderId);
      if (!isAdmin) {
      return bot.sendMessage(chatId, `<blockquote>❌ Hanya admin grup yang bisa mengatur AntiLink.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

    const status = match[1] ? match[1].toLowerCase() : null;

    if (status === 'on') {
      antilink[chatId] = true;
      fs.writeFileSync(dbAntiLink, JSON.stringify(antilink, null, 2));
      return bot.sendMessage(chatId, `<blockquote>✅ AntiLink aktif di grup ini.</blockquote>`, {
    parse_mode: "HTML"
    });
      } else if (status === 'off') {
        delete antilink[chatId];
        fs.writeFileSync(dbAntiLink, JSON.stringify(antilink, null, 2));
        return bot.sendMessage(chatId, `<blockquote>✅ AntiLink dimatikan di grup ini.</blockquote>`, {
    parse_mode: "HTML"
    });
      } else {
        return bot.sendMessage(chatId, `<blockquote>📌 Gunakan:\n/antilink on\n/antilink off</blockquote>`, {
    parse_mode: "HTML"
    });
  }
    } catch (err) {
      console.error('[ANTILINK CMD ERROR]', err);
      bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat mengatur AntiLink.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || '';

  if (antilink[chatId]) {
    const linkPattern = /(https?:\/\/|t\.me\/|telegram\.me\/|chat\.whatsapp\.com|wa\.me\/)/i;

    if (linkPattern.test(text)) {
      const admins = await bot.getChatAdministrators(chatId);
      const isAdmin = admins.some(admin => admin.user.id === msg.from.id);

      if (!isAdmin) {
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          console.error('❌ Gagal hapus pesan:', e.message);
        }
      }
    }
  }
});


bot.onText(/\/hubungiowner/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  let targetUser = msg.from;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  const username = targetUser.username
      ? `@${escapeHtml(targetUser.username)}`
      : "-";
  if (chatSessions[user.id]?.active) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Kamu sudah dalam sesi dengan owner.\nKetik /selesai untuk mengakhiri sesi ini.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Terima", callback_data: `accept_${user.id}` },
          { text: "❌ Tolak", callback_data: `reject_${user.id}` }
        ]
      ]
    }
  };

  await bot.sendMessage(
    OWNER,
    `<blockquote>📞 Ada user ingin menghubungi anda\n\n👤 Nama: ${username} ${user.last_name || ""}\n🆔 ID: <code>${user.id}</code>\n\nIngin menerima?</blockquote>`,
    { parse_mode: "HTML", ...opts }
  );

  await bot.sendMessage(chatId, `<blockquote>⏳ Harap Tunggu respon dari owner...</blockquote>`, {
  parse_mode: "HTML"
  });
});

bot.on("callback_query", async (query) => {
  const data = query.data;
  const fromId = query.from.id;
  
  if (!data.startsWith("accept_") && !data.startsWith("reject_")) return;

  if (fromId !== OWNER) {
    return bot.answerCallbackQuery(query.id, { text: "❌ Hanya owner yang bisa melakukan ini." });
  }

  const userId = parseInt(data.split("_")[1]);

  if (data.startsWith("accept_")) {
    chatSessions[userId] = { active: true, ownerId: OWNER };

    await bot.answerCallbackQuery(query.id, { text: "✅ Permintaan diterima" });
    await new Promise(r => setTimeout(r, 200));

    await bot.sendMessage(userId,
      `<blockquote>✅ Owner menerima permintaanmu!\nSekarang kamu bisa mengirim pesan langsung ke owner.\nKetik /selesai untuk mengakhiri sesi ini.</blockquote>`, {
      parse_mode: "HTML"
    });

    await bot.sendMessage(OWNER,
      `<blockquote>💬 Kamu kini terhubung dengan user ${userId}. Semua pesan akan diteruskan.</blockquote>`,
      { parse_mode: "HTML" }
    );
  } else if (data.startsWith("reject_")) {
    await bot.answerCallbackQuery(query.id, { text: "❌ Permintaan ditolak" });
    await bot.sendMessage(userId, `<blockquote>🚫 Owner sedang sibuk dan tidak dapat dihubungi saat ini.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.on("message", async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (msg.text === "/selesai" && chatSessions[userId]?.active) {
    delete chatSessions[userId];
    await bot.sendMessage(chatId, `<blockquote>✅ Sesi dengan owner telah diakhiri.</blockquote>`, {
    parse_mode: "HTML"
    });
    await bot.sendMessage(OWNER, `<blockquote>🔚 Sesi dengan user [${userId}] telah diakhiri.</blockquote>`, {
    parse_mode: "HTML"
    });
    return;
  }

  if (msg.text === "/selesai" && userId === OWNER) {
    const targetId = Object.keys(chatSessions).find(id => chatSessions[id].ownerId === OWNER);
    if (targetId) {
      delete chatSessions[targetId];
      await bot.sendMessage(OWNER, `<blockquote>✅ Kamu mengakhiri sesi dengan user.</blockquote>`, {
      parse_mode: "HTML"
      });
      await bot.sendMessage(targetId, `<blockquote>🔚 Owner mengakhiri sesi chat.</blockquote>`, {
      parse_mode: "HTML"
      });
    }
    return;
  }

  if (chatSessions[userId]?.active) {
    try {
      await bot.forwardMessage(OWNER, chatId, msg.message_id);
      return;
    } catch (err) {
      console.error("❌ Gagal meneruskan pesan ke owner:", err.message);
      await bot.sendMessage(
        OWNER,
        `<blockquote>📩 Dari ${msg.from.first_name} (ID: ${userId})\n\n${msg.text || "[non-text message]"}</blockquote>`,
        { parse_mode: "HTML" }
      );
    }
  }
  
  const targetUserId = Object.keys(chatSessions).find(id => chatSessions[id].ownerId === userId);
  if (targetUserId && chatSessions[targetUserId]?.active && userId === OWNER && msg.text) {
    await bot.sendMessage(targetUserId, `<blockquote>👑 Owner: ${msg.text}</blockquote>`, {
    parse_mode: "HTML"
    });
    return;
  }

  if (chatSessions[userId]?.active && msg.text?.startsWith("/")) {
    return bot.sendMessage(chatId, `<blockquote>🚫 Kamu sedang dalam sesi chat dengan owner. Ketik /selesai untuk keluar.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/bypass$/i, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const reply = msg.reply_to_message;
  
  if (maintenanceCheck(bot, msg)) return;
  
  const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }

  if (!reply || !reply.document) {
    return bot.sendMessage(chatId, '❗ Reply ke file yang mau di bypass filenya, lalu kirim /bypass');
  }

  const doc = reply.document;
  const filename = doc.file_name || 'file.txt';

  if (!extAllowed(filename)) {
    return bot.sendMessage(chatId, `❗ File *${filename}* tidak didukung. Hanya file teks yang boleh.`, { parse_mode: 'Markdown' });
  }

  try {
    await bot.sendChatAction(chatId, 'typing');

    const fileLink = await bot.getFileLink(doc.file_id);
    const res = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const originalText = res.data.toString('utf8');

    const newContent = SYSTEM_HEADER + originalText;

    const tmpDir = './tmp';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const tmpPath = path.join(tmpDir, `${Date.now()}_${filename}`);
    fs.writeFileSync(tmpPath, newContent, 'utf8');

    await bot.sendDocument(chatId, tmpPath, {
      caption: `✅ Bypass system berhasil ditambahkan ke file *${filename}*`,
      parse_mode: 'Markdown'
    });

    fs.unlinkSync(tmpPath);
  } catch (err) {
    console.error('ERR /system:', err);
    bot.sendMessage(chatId, '⚠️ Gagal memproses file. Pastikan file berupa teks dan tidak terlalu besar.');
  }
});

bot.onText(/^\/filter (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(' ');
  
  if (maintenanceCheck(bot, msg)) return;

  if (args.length < 2) {
    return bot.sendMessage(chatId, '❌ Format salah!\nGunakan: /filter <kata> <respon>');
  }

  const keyword = args.shift().toLowerCase();
  const response = args.join(' ');

  if (!filters[chatId]) filters[chatId] = {};

  filters[chatId][keyword] = response;

  fs.writeFileSync(filterFile, JSON.stringify(filters, null, 2));

  bot.sendMessage(chatId, `✅ Filter ditambahkan!\n\nKata: *${keyword}*\nRespon: *${response}*`, {
    parse_mode: 'Markdown'
  });
});

bot.on('message', (msg) => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.toLowerCase();

  if (!filters[chatId]) return;

  for (const keyword in filters[chatId]) {
    if (text.includes(keyword)) {
      return bot.sendMessage(chatId, filters[chatId][keyword], {
        reply_to_message_id: msg.message_id
      });
    }
  }
});

bot.onText(/\/pw (.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const password = (match[1] || '').trim();
  const reply = msg.reply_to_message;

  if (!password) {
    return bot.sendMessage(chatId, "⚠️ Contoh: /pw 12345 (reply ke file .js)");
  }

  if (!reply || !reply.document) {
    return bot.sendMessage(chatId, "📂 Reply command ini ke file .js kamu biar otomatis diproteksi password.");
  }

  try {
    const fileId = reply.document.file_id;
    const origFileName = reply.document.file_name || 'script.js';
    const fileUrl = await bot.getFileLink(fileId);

    const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const userScript = Buffer.from(res.data).toString('utf8');

    const ext = path.extname(origFileName) || '.js';
    const base = path.basename(origFileName, ext);
    const outName = `${base}.protected${ext}`;
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${outName}`);

    // password langsung dijadiin string literal aman
    const pwLiteral = JSON.stringify(password);

    // versi paling bersih tanpa escape/split
    const protectedScript = `const readline = require('readline');
const PW = ${pwLiteral};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.clear();
console.log('🔐 MASUKAN PASSWORD NYA:');

rl.question('', (inputPassword) => {
  if (inputPassword !== PW) {
    console.log('❌ PASSWORD SALAH');
    rl.close();
    process.exit(1);
  }

  console.log('✅ PASSWORD BENAR');
  console.log('WELCOME TO THE SCRIPT\\n');
  rl.close();
  runScript();
});

function runScript() {
${userScript}
}
`;

    fs.writeFileSync(tmpPath, protectedScript, 'utf8');

    await bot.sendDocument(chatId, tmpPath, {
      caption: `✅ Script berhasil diproteksi!\n🔒 Password: ${password}`
    });

    try { fs.unlinkSync(tmpPath); } catch {}

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, `❌ Gagal memproses file:\n${err.message}`);
  }
});

bot.onText(/^\/rasukbot (.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1];

  if (!input.includes("|")) {
    return bot.sendMessage(chatId,
      "📩 Format salah!\n\nGunakan format:\n" +
      "<code>/message token|id|pesan|jumlah</code>\n\n" +
      "Contoh:\n<code>/message 123456:ABCDEF|987654321|Halo bro|5</code>",
      { parse_mode: "HTML" }
    );
  }

  try {
    const [token, targetId, pesan, jumlahStr] = input.split("|").map(x => x.trim());
    const jumlah = parseInt(jumlahStr);

    if (!token || !targetId || !pesan || isNaN(jumlah)) {
      return bot.sendMessage(chatId,
        "❌ Format salah!\nGunakan: <code>/message token|id|pesan|jumlah</code>",
        { parse_mode: "HTML" }
      );
    }

    await bot.sendMessage(chatId, "🚀 Mengirim pesan...");
    for (let i = 1; i <= jumlah; i++) {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: targetId,
        text: pesan
      });
    }

    bot.sendMessage(chatId, `✅ Berhasil mengirim ${jumlah} pesan ke ID <code>${targetId}</code>`, {
      parse_mode: "HTML"
    });

  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal mengirim pesan:\n<code>${err.message}</code>`, {
      parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/enchard$/i, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  const member = await bot.getChatMember(CHANNEL_ID, userId);
  if (member.status === "left" || member.status === "kicked") {
    return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
    });
  }

  if (!msg.reply_to_message || !msg.reply_to_message.document) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Balas file .js dengan perintah /enchard untuk mengenkripsi.</blockquote>`, {
      parse_mode: "HTML"
    });
  }

  const file = msg.reply_to_message.document;
  const fileName = file.file_name || "unknown.js";

  if (!fileName.toLowerCase().endsWith(".js")) {
    return bot.sendMessage(chatId, `<blockquote>❌ File harus berformat .js</blockquote>`, { parse_mode: "HTML" });
  }


  const db = JSON.parse(fs.readFileSync("./database/users.json", "utf8"));
  const user = db[userId] || {};
  if (!user.isPremium || !isPremiumActive(user)) {
    return bot.sendMessage(chatId, `<blockquote>🚫 Fitur ini hanya untuk pengguna Premium aktif.</blockquote>`, { parse_mode: "HTML" });
  }


  const loadingMsg = await bot.sendMessage(chatId, `<blockquote>🔒 Sedang mengenkripsi file ${fileName}...</blockquote>`, { parse_mode: "HTML" });

  try {

    const fileLink = await bot.getFileLink(file.file_id);
    const response = await axios.get(fileLink, { responseType: "text", timeout: 20000 });

    const encrypted = encryptJS(response.data);

    const outputName = fileName.replace(".js", "_enc.js");
    const outputPath = path.join(__dirname, outputName);
    fs.writeFileSync(outputPath, encrypted);

    await bot.deleteMessage(chatId, loadingMsg.message_id);
    await bot.sendDocument(chatId, outputPath, {}, { filename: outputName, contentType: "application/javascript" });

    fs.unlinkSync(outputPath);

  } catch (err) {
    console.error("/enchard error:", err.message);
    await bot.sendMessage(chatId, `<blockquote>❌ Gagal mengenkripsi file:\n<code>${err.message}</code></blockquote>`, { parse_mode: "HTML" });
  } finally {
    try { await bot.deleteMessage(chatId, loadingMsg.message_id); } catch (_) {}
  }
});

//===================== MORE =====================

bot.onText(/^\/cekkodam(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const nama = (match[1] || '').trim();
  
  if (maintenanceCheck(bot, msg, chatId)) return;

  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    if (member.status === 'left' || member.status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "📢 Channel Official", url: CHANNEL_LINK }]] }
      });
    }

    if (!nama) {
      return bot.sendMessage(chatId, `<blockquote>🤓 Namanya mana anjeng? ketik /cekkhodam nama</blockquote>`, { 
      parse_mode: 'HTML' 
      });
    }

    if (!cekKhodam.length) {
      return bot.sendMessage(chatId, `⚠️ List khodam kosong / gagal dimuat dari Database.`, {
      parse_mode: "HTML"
      });
    }

    const hasil = `<blockquote>𖤐 ʜᴀsɪʟ ᴄᴇᴋ ᴋʜᴏᴅᴀᴍ:
╭───────────────────────
├ • ɴᴀᴍᴀ : ${nama}
├ • ᴋʜᴏᴅᴀᴍɴʏᴀ : ${pickRandom(cekKhodam)}
├ • ɴɢᴇʀɪ ʙᴇᴛ ᴊɪʀ ᴋʜᴏᴅᴀᴍɴʏᴀ
╰────────────────────────
ɴᴇxᴛ ᴄᴇᴋ ᴋʜᴏᴅᴀᴍɴʏᴀ sɪᴀᴘᴀ ʟᴀɢɪ.
</blockquote>`;

    bot.sendMessage(chatId, hasil, { parse_mode: 'HTML' });
  } catch (error) {
    console.error("❌ Error cek khodam:", error);
    bot.sendMessage(chatId, `<blockquote>⚠️ Terjadi kesalahan saat cek khodam. Coba lagi nanti.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cektampan$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }

  const nilai = [10, 20, 30, 35, 45, 50, 54, 68, 73, 78, 83, 90, 94, 100][Math.floor(Math.random() * 14)];
  const teks = `<blockquote>📊 HASIL TES KETAMPANAN
👤 Nama: ${msg.from.first_name}
💯 Nilai: ${nilai}%
🗣️ Komentar: ${komentarTampan(nilai)}
</blockquote>`;
  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cekcantik$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = [10, 20, 30, 35, 45, 50, 54, 68, 73, 78, 83, 90, 94, 100][Math.floor(Math.random() * 14)];
  const teks = `<blockquote>📊 HASIL TES KECANTIKAN
👤 Nama: ${msg.from.first_name}
💯 Nilai: ${nilai}%
🗣️ Komentar: ${komentarCantik(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cekkaya$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100][Math.floor(Math.random() * 10)];
  const teks = `<blockquote>💵 HASIL TES KEKAYAAN
👤 Nama: ${msg.from.first_name}
💰 Nilai: ${nilai}%
🗣️ Komentar: ${komentarKaya(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cekmiskin$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100][Math.floor(Math.random() * 10)];
  const teks = `<blockquote>📉 HASIL TES KEMISKINAN
👤 Nama: ${msg.from.first_name}
📉 Nilai: ${nilai}%
🗣️ Komentar: ${komentarMiskin(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cekjanda$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = Math.floor(Math.random() * 101);
  const teks = `<blockquote>👠 HASIL TES KEJANDAAN
👤 Nama: ${msg.from.first_name}
📊 Nilai: ${nilai}%
🗣️ Komentar: ${komentarJanda(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cekpacar$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = Math.floor(Math.random() * 101);
  const teks = `<blockquote>💕 HASIL TES KEPACARAN
👤 Nama: ${msg.from.first_name}
📊 Nilai: ${nilai}%
🗣️ Komentar: ${komentarPacar(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/ceksabar$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = Math.floor(Math.random() * 101);
  const teks = `<blockquote>💕 HASIL TES KESABARAN
👤 Nama: ${msg.from.first_name}
📊 Nilai: ${nilai}%
🗣️ Komentar: ${komentarSabar(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cektolol$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = Math.floor(Math.random() * 101);
  const teks = `<blockquote>💕 HASIL TES KETOLOLAN
👤 Nama: ${msg.from.first_name}
📊 Nilai: ${nilai}%
🗣️ Komentar: ${komentarTolol(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/cekmati$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (maintenanceCheck(bot, msg, chatId)) return;
  
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    const status = member.status;

    if (status === 'left' || status === 'kicked') {
      return bot.sendMessage(chatId, `<blockquote>🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.</blockquote>`, {
      parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "Channel Official", url: CHANNEL_LINK }
          ]]
        }
      });
    }
  const nilai = Math.floor(Math.random() * 101);
  const teks = `<blockquote>💕 HASIL TES KETOLOLAN
👤 Nama: ${msg.from.first_name}
📊 Nilai: ${nilai}%
🗣️ Komentar: ${komentarMati(nilai)}
</blockquote>`.trim();

  bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `<blockquote>❌ Terjadi kesalahan saat pengecekan status keanggotaan grup/channel.</blockquote>`, {
    parse_mode: "HTML"
    });
  }
});

bot.onText(/^\/profile$/, (msg) => {
  const userId = msg.from.id;
  const user = users[userId];

  if (!user) {
    return bot.sendMessage(msg.chat.id, `<blockquote>❌ Kamu belum punya data! Kirim pesan dulu biar sistem nyimpen datamu.</blockquote>`, {
    parse_mode: "HTML"
    });
  }

  const need = xpNeeded(user.level);
  const bar = getBar(user.xp, need);

  const profile = `<blockquote>📜 Profil Kamu
👤 Nama: ${user.name}
🏅 Level: ${user.level}
💠 Role: ${user.role}
⚡ XP: ${user.xp} / ${need}
${bar}</blockquote>`.trim();

  bot.sendMessage(msg.chat.id, profile, { parse_mode: "HTML" });
});

bot.on("message", (msg) => {
  const userId = msg.from.id;
  const name = msg.from.first_name;

  if (!users[userId]) {
    users[userId] = { id: userId, name, xp: 0, level: 1, role: "Pemula" };
  }

  const user = users[userId];
  user.xp += 10;

  const need = xpNeeded(user.level);
  if (user.xp >= need) {
    user.xp -= need;
    user.level++;
    user.role = getRole(user.level);
    bot.sendMessage(msg.chat.id, `<blockquote>🎉 ${name} naik ke level ${user.level}!\nSekarang role kamu: ${user.role}</blockquote>`, { parse_mode: "HTML" });
  }

  saveDB();
});

bot.on('new_chat_members', async (msg) => {
  const newMembers = msg.new_chat_members;
  if (!newMembers || !Array.isArray(newMembers)) return;

  if (!bot.botInfo) bot.botInfo = await bot.getMe();

  const botItself = newMembers.find(m => m.id === bot.botInfo.id);
  if (!botItself) return;

  const adder = msg.from;
  if (!adder) {
    console.log('⚠️ Tidak tahu siapa yang menambahkan bot (mungkin lewat link undangan).');
    return;
  }

  const adderId = adder.id;
  const adderName = adder.first_name || "User";
  const bonusExtra = 2;

  if (!users[adderId]) users[adderId] = { extraLimit: 0 };
  
  users[adderId].extraLimit = (users[adderId].extraLimit || 0) + bonusExtra;
  saveUsers();

  try {
    await bot.sendMessage(adderId, `<blockquote>🎉 Terima kasih sudah menambahkan bot ke grup!\n\n🎁 Kamu dapat bonus +${bonusExtra} extra limit.\n📊 Total extra limit kamu sekarang: ${users[adderId].extraLimit}</blockquote>`, {
    parse_mode: "HTML"
    });
  } catch {
    await bot.sendMessage(msg.chat.id, `<blockquote>🎁 ${adderName} baru menambahkan bot ke grup ini!\nBonus +${bonusExtra} extra limit diberikan.</blockquote>`, {
    parse_mode: "HTML" });
  }

  console.log(`✅ ${adderName} (${adderId}) mendapat +${bonusExtra} extraLimit karena menambahkan bot ke grup ${msg.chat.title}.`);
});

bot.on('message', (msg) => {
  const waktu = moment().tz('Asia/Jakarta').format('HH:mm:ss');
  const nama = msg.from.first_name || 'Tanpa Nama';
  const username = msg.from.username ? `@${msg.from.username}` : '(tidak ada username)';
  const isiPesan = msg.text || 'Non-text message';
  const chatType = msg.chat.type;
  
  console.log(chalk.green(`┏━━━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.blue(`┃𝗝𝗮𝗺 : [${waktu}]`));
  console.log(chalk.red(`┃𝗧𝘆𝗽𝗲 𝗖𝗵𝗮𝘁 : [${chatType}]`));
  console.log(chalk.grey(`┃𝗡𝗮𝗺𝗮 𝗨𝘀𝗲𝗿 : ${nama}`));
  console.log(chalk.red(`┃𝗨𝘀𝗲𝗿 𝗡𝗮𝗺𝗲 : ${username}`));
  console.log(chalk.blue(`┃𝗣𝗲𝘀𝗮𝗻 𝗨𝘀𝗲𝗿 : ${isiPesan}`));
  console.log(chalk.green(`┗━━━━━━━━━━━━━━━━━━━━`));
});

console.clear();
console.log(chalk.blue(`⣿⣿⣿⣿⣿⣿⡿⠿⠿⠿⢿⡶⠶⣶⣶⣴⣯⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⣏⣭⣭⣽⣿⣻⣿⣿⣿⣿⣿⣿⣿\n⣿⣿⣿⣿⣿⠟⠁⠀⠀⢀⣀⣀⠉⠉⠚⠋⣝⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡵⢿⡛⠛⠛⠉⠉⠉⠩⣼⣿⣿⣿⣿⣿\n⣿⣿⣟⡋⠁⠀⢀⣴⣿⣿⣿⠋⠁⠀⠀⠀⠨⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠚⠁⠀⠠⣶⣶⣦⣄⠀⠀⠙⠿⣿⣿⣿\n⣿⣿⠟⠁⠀⣴⣿⣿⣿⣿⣟⠀⠣⡉⢨⠆⢐⣜⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣏⠠⡒⠤⡆⠘⣿⣿⣿⣿⣄⠀⠘⢿⣿⣿\n⣍⣀⣀⣀⠀⢿⣿⣿⣿⣿⣿⣄⣀⠈⢃⣠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⠐⠔⠃⢰⣿⣿⣿⣿⣿⠆⠀⣀⣈⣙\n⣿⣿⣿⣿⣷⣶⣭⣿⣿⢿⡿⠟⣉⣩⣭⣿⣿⣿⣿⣿⠀⣿⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣒⡒⡚⠻⣿⣿⣿⣿⣵⣾⣿⣿\n⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿`));
console.log(chalk.cyan.bold("==========================================="));
console.log(chalk.greenBright.bold(`🤖 ${NAMA_BOT} 𝗩${VERSION}`));
console.log(chalk.yellow(`📅 ${moment().tz('Asia/Jakarta').format('dddd, DD MMMM YYYY HH:mm:ss')}`));
console.log(chalk.blueBright(`🧠 Developer: ${OWNER}`));
console.log(chalk.magenta(`💻 Platform: ${os.type()} ${os.release()}`));
console.log(chalk.white(`🧩 Node.js version: ${process.version}`));
console.log(chalk.greenBright(`🚀 Status: Bot berhasil dijalankan dan sedang polling...`));
console.log(chalk.cyan.bold("==========================================="));

getChannelId();