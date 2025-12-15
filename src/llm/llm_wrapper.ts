export class LLMClient {
  public apiKey: string;
  public api_base: string;
  public provider: string;
  public model: string;

  constructor(
    apiKey: string,
    api_base: string,
    provider: string,
    model: string
  ) {
    this.apiKey = apiKey;
    this.api_base = api_base;
    this.provider = provider;
    this.model = model;
  }
}
