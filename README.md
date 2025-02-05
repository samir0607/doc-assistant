🚀 Rocket.Chat AI Docs Assistant
This project scrapes Rocket.Chat documentation, extracts and indexes text using OpenAI embeddings, and enables AI-powered search & Q&A with a streaming chatbot interface.

✨ Features
📄 Web Scraping → Extracts content from Rocket.Chat docs using Puppeteer.
🔀 Text Chunking → Splits large documents into smaller, meaningful chunks.
🧠 AI Embeddings → Uses OpenAI’s text-embedding-3-small model to convert text into vectors.
📦 AstraDB Storage → Stores embeddings in AstraDB for fast vector search.
💬 AI-Powered Chatbot → Uses GPT-4o-mini to answer user questions with relevant docs as context.
⚡ Streaming Responses → Implements Vercel AI SDK for real-time responses.

## Getting strated

### Clone the repository
  `git clone https://github.com/samir0607/doc-assistant`

First, run the development server:

### Set up Database and .env File
Go to astra database and create your serverless vector database.
Go to OpenAI create an account and make sure you have credits.
Get the API keys and update the following .env file and save it in the doc-assistant library
```.env
ASTRA_DB_NAMESPACE=""
ASTRA_DB_COLLECTION=""
ASTRA_DB_API_ENDPOINT=""
ASTRA_DB_APPLICATION_TOKEN=""
OPENAI_API_KEY=""

```

### Store vectors in your Database
```bash
npm run seed
```
### Finally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
