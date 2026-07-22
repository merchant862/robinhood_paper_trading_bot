const axios = require('axios');
const config = require('../config');
const { Alert } = require('../db');
const logger = require('../logger');

const sentTimestamps = [];

function canSendNow() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (sentTimestamps.length && sentTimestamps[0] < cutoff) {
    sentTimestamps.shift();
  }
  return sentTimestamps.length < config.whatsapp.maxPerHour;
}

async function sendWhatsApp({ tokenId = null, type, score = null, message }) {
  const sentTo = config.whatsapp.chatId || null;

  if (!config.whatsapp.enabled) {
    await Alert.create({
      token_id: tokenId,
      alert_type: type,
      score,
      message,
      sent_to: sentTo,
      sent_at: new Date(),
      status: 'dry_run',
    });
    logger.info({ type, score, message }, 'whatsapp dry-run alert');
    return;
  }

  if (!config.whatsapp.instanceId || !config.whatsapp.token || !config.whatsapp.chatId) {
    throw new Error('Green API credentials or WHATSAPP_CHAT_ID missing');
  }

  if (!canSendNow()) {
    await Alert.create({
      token_id: tokenId,
      alert_type: type,
      score,
      message,
      sent_to: sentTo,
      sent_at: new Date(),
      status: 'throttled',
    });
    logger.warn({ type, score }, 'whatsapp alert throttled');
    return;
  }

  const url = `${config.whatsapp.apiUrl}/waInstance${config.whatsapp.instanceId}/sendMessage/${config.whatsapp.token}`;
  await axios.post(url, { chatId: config.whatsapp.chatId, message, linkPreview: false }, { timeout: 15000 });
  sentTimestamps.push(Date.now());

  await Alert.create({
    token_id: tokenId,
    alert_type: type,
    score,
    message,
    sent_to: sentTo,
    sent_at: new Date(),
    status: 'sent',
  });
}

module.exports = { sendWhatsApp };
