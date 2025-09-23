const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const KnowledgeItem = require('../models/KnowledgeItem');

let storePromise = null;

function getEmbeddings() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenerativeAIEmbeddings({ apiKey, modelName: 'text-embedding-004' });
}

async function buildStoreIfNeeded() {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await KnowledgeItem.find().lean();
    const texts = docs.map(d => `${d.title || d.sourceName || 'Item'}\n\n${d.content || ''}`);
    const metas = docs.map(d => ({ id: String(d._id), title: d.title || d.sourceName, sourceType: d.sourceType || 'unknown' }));
    const store = await MemoryVectorStore.fromTexts(texts, metas, embeddings);
    return store;
  })();
  return storePromise;
}

async function retrieverQuery(text, k = 4) {
  const store = await buildStoreIfNeeded();
  const results = await store.similaritySearch(text, k);
  const ids = results.map(r => r.metadata?.id).filter(Boolean);
  if (ids.length === 0) return [];
  const items = await KnowledgeItem.find({ _id: { $in: ids } }).lean();
  const byId = new Map(items.map(e => [String(e._id), e]));
  return results.map(r => byId.get(r.metadata.id)).filter(Boolean);
}

async function upsertKnowledge(doc) {
  const store = await buildStoreIfNeeded();
  const embeddings = getEmbeddings();
  const text = `${doc.title || doc.sourceName || 'Item'}\n\n${doc.content || ''}`;
  const tmp = await MemoryVectorStore.fromTexts([text], [{ id: String(doc._id), title: doc.title || doc.sourceName, sourceType: doc.sourceType || 'unknown' }], embeddings);
  store.memoryVectors.push(...tmp.memoryVectors);
}

module.exports = { retrieverQuery, upsertKnowledge };


