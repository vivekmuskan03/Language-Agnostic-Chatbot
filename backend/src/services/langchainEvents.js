const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const Event = require('../models/Event');

let storePromise = null;

function getEmbeddings() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenerativeAIEmbeddings({ apiKey, modelName: 'text-embedding-004' });
}

async function buildStoreIfNeeded() {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await Event.find().lean();
    const texts = docs.map(d => `${d.title}\n\n${d.description || ''}`);
    const metadatas = docs.map(d => ({ id: String(d._id), title: d.title }));
    const store = await MemoryVectorStore.fromTexts(texts, metadatas, embeddings);
    return store;
  })();
  return storePromise;
}

async function retrieverQuery(queryText, k = 4) {
  const store = await buildStoreIfNeeded();
  const results = await store.similaritySearch(queryText, k);
  const ids = results.map(r => r.metadata?.id).filter(Boolean);
  if (ids.length === 0) return [];
  const events = await Event.find({ _id: { $in: ids } }).lean();
  const byId = new Map(events.map(e => [String(e._id), e]));
  return results.map(r => byId.get(r.metadata.id)).filter(Boolean);
}

async function upsertEventIntoStore(eventDoc) {
  const store = await buildStoreIfNeeded();
  const text = `${eventDoc.title}\n\n${eventDoc.description || ''}`;
  const embeddings = getEmbeddings();
  const tmp = await MemoryVectorStore.fromTexts([text], [{ id: String(eventDoc._id), title: eventDoc.title }], embeddings);
  store.memoryVectors.push(...tmp.memoryVectors);
}

module.exports = { retrieverQuery, upsertEventIntoStore };


