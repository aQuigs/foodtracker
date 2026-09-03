import { InMemoryFoodSourceRepository } from '../../src/persistence/inMemoryFoodSource.js';
import { describeFoodSourceRepositoryContract } from './foodSourceRepositoryContract.js';

describeFoodSourceRepositoryContract(
  'InMemoryFoodSourceRepository',
  async () => ({ repo: new InMemoryFoodSourceRepository() }),
);
