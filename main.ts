import { config } from './config';

interface SuccessResponse {
	model_version: string;
	completions: {
		completion: string;
		log_probs: object;
		raw_completion: string;
		completion_tokens: string[];
		finish_reason: string;
	}[];
	optimized_prompt?: {
		type: 'text';
		data: string;
	}[];
	num_tokens_prompt_total: number;
	num_tokens_generated: number;
}

interface Completion {
	Content: string;
	TokenUsage?: number;
}

interface ConnectorResponse {
	Completions: Completion[];
	ModelType: string;
}

interface ChatCompletion {
	output: string;
	stats: { num_tokens_prompt_total: number };
}

const mapToResponse = (
	outputs: (ChatCompletion | ErrorCompletion)[],
	model: string,
): ConnectorResponse => {
	return {
		Completions: outputs.map((output) => {
			if ('error' in output) {
				return {
					Content: output.error,
					TokenUsage: output.usage,
				};
			}

			return {
				Content: output.output,
				TokenUsage: output.stats.num_tokens_prompt_total,
			};
		}),
		ModelType: model,
	};
};

interface ErrorCompletion {
	error: string;
	model: string;
	usage: undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapErrorToCompletion = (error: any, model: string): ErrorCompletion => {
	const errorMessage = error.error || JSON.stringify(error);
	return {
		error: errorMessage,
		model,
		usage: undefined,
	};
};

export interface ConnectorSetting {
	SettingID: string;
	Name: string;
	Value?: string;
	Type: string;
}

async function main(
	model: string,
	prompts: string[],
	properties: Record<string, unknown>,
	settings: Record<string, unknown>,
): Promise<ConnectorResponse> {
	const url = `https://api.aleph-alpha.com/complete`;

	const { maximum_tokens, ...restProperties } = properties;

	const outputs: (ChatCompletion | ErrorCompletion)[] = [];

	const defaultMaxToken = config.properties.filter(
		(property) => property.id === 'maximum_tokens',
	)[0];

	try {
		for (const prompt of prompts) {
			try {
				const dataContent = [{ type: 'text', data: prompt }];

				const data = {
					model,
					prompt: dataContent,
					maximum_tokens: maximum_tokens || defaultMaxToken.value,
					...restProperties,
				};

				const assistantResponse: SuccessResponse = await (
					await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Accept: 'application/json',
							Authorization: `Bearer ${settings?.['BEARER_TOKEN']}`,
						},
						body: JSON.stringify(data),
					})
				).json();

				console.log(assistantResponse);

				outputs.push({
					output: assistantResponse.completions
						.map((completion) => completion.completion)
						.join('\n'),
					stats: {
						num_tokens_prompt_total: assistantResponse.num_tokens_prompt_total,
					},
				});

				console.log(`Response to prompt: ${prompt}`, assistantResponse);
			} catch (error) {
				const completionWithError = mapErrorToCompletion(error, model);
				outputs.push(completionWithError);
			}
		}

		return mapToResponse(outputs, model);
	} catch (error) {
		console.error('Error in main function:', error);
		throw error;
	}
}

export { main, config };
