import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const portFlag = process.argv.indexOf('--port');
const PORT = process.env.PORT || (portFlag >= 0 ? process.argv[portFlag + 1] : 3000);

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Dev server listening on port ${PORT}`);
});
