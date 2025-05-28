# Bank Statement Analyzer API

This project is a Node.js and Express.js backend API designed to analyze bank statements. It allows users to upload PDF files of bank statements, which are then processed to extract relevant information. The API integrates with external LLM APIs for further analysis.

## Project Structure

```
bank-statement-analyzer-api
├── src
│   ├── app.js
│   ├── server.js
│   ├── routes
│   │   └── analysisRoutes.js
│   ├── controllers
│   │   └── analysisController.js
│   ├── services
│   │   ├── llmService.js
│   │   └── pdfParserService.js
│   └── middleware
│       └── authMiddleware.js
├── uploads
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Features

- Upload bank statement PDF files via a POST request.
- Parse PDF files to extract account details and transactions.
- Integrate with external LLM APIs (Perplexity and DeepSeek) for advanced analysis.
- Return a JSON response with the analysis results.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node package manager)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd bank-statement-analyzer-api
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file and fill in the required environment variables.

### Running the Application

To start the server in development mode, use:
```
npm run dev
```

The server will be running on `http://localhost:3000` (or the port specified in your `.env` file).

### API Endpoints

- **POST /api/analyze**: Upload a bank statement PDF for analysis.

## License

This project is licensed under the MIT License. See the LICENSE file for details.