import { createApp } from './app';
import { config } from './infrastructure/config';
import { logger } from './common/logger';

const app = createApp();

const PORT = config.PORT;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
