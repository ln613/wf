import { MongoClient } from 'mongodb'

let cachedDb = null
let cachedClient = null

const getDbName = () => {
  const env = process.env.NODE_ENV === 'development'
    ? 'dev'
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'qa'
  return env ? `wf-${env}` : 'wf'
}

export const connectDB = async () => {
  if (cachedDb) return cachedDb

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not defined')

  const client = new MongoClient(uri)
  await client.connect()

  cachedClient = client
  cachedDb = client.db(getDbName())

  return cachedDb
}

export const getCollection = async (name) => {
  const db = await connectDB()
  return db.collection(name)
}

export const get = async (collectionName, filter = {}, options = {}) => {
  const collection = await getCollection(collectionName)
  const { projection, sort, limit, skip } = options

  let cursor = collection.find(filter)

  if (projection) cursor = cursor.project(projection)
  if (sort) cursor = cursor.sort(sort)
  if (skip) cursor = cursor.skip(skip)
  if (limit) cursor = cursor.limit(limit)

  return cursor.toArray()
}

export const getOne = async (collectionName, filter = {}, options = {}) => {
  const collection = await getCollection(collectionName)
  return collection.findOne(filter, options)
}

export const save = async (collectionName, doc) => {
  if (!doc) throw new Error('Document is required')

  const collection = await getCollection(collectionName)

  if (doc._id) {
    const { _id, ...updateDoc } = doc
    await collection.updateOne({ _id }, { $set: updateDoc }, { upsert: true })
    return doc
  }

  const result = await collection.insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export const remove = async (collectionName, filter) => {
  if (!filter) throw new Error('Filter is required')

  const collection = await getCollection(collectionName)
  return collection.deleteOne(filter)
}