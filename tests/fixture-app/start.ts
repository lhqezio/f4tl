import { startServer } from './server.js';

startServer().then((app) => {
  console.log(`Fixture app running at ${app.url}`);
  process.on('SIGINT', () => app.close().then(() => process.exit(0)));
  process.on('SIGTERM', () => app.close().then(() => process.exit(0)));
});
