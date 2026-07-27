// Controllers destructure `chatCompletionsCreate` from aiService at require time,
// so the binding is fixed before jest.spyOn could attach — a spy silently does
// nothing and the test makes a real Gemini call. The module must be mocked with
// a factory instead, and the factory must be registered before the controller
// under test is required (jest.mock is hoisted, so a top-level call is enough).
//
//   jest.mock('../services/aiService', () => require('./helpers/mockAiService').factory());
//   const { mockGeminiJSON, mockGeminiRaw, resetGemini } = require('./helpers/mockAiService');

function factory() {
  return {
    ...jest.requireActual('../../services/aiService'),
    chatCompletionsCreate: jest.fn(),
    generateContentWithInlineData: jest.fn(),
  };
}

const getMock = () => require('../../services/aiService').chatCompletionsCreate;
const getVisionMock = () => require('../../services/aiService').generateContentWithInlineData;

/** Stub the next Gemini reply with `value` serialized as JSON. */
function mockGeminiJSON(value) {
  getMock().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(value) } }],
  });
}

/** Stub the next Gemini reply with a raw string — for malformed/fenced output. */
function mockGeminiRaw(text) {
  getMock().mockResolvedValue({ choices: [{ message: { content: text } }] });
}

/** Stub the vision model (generateContentWithInlineData) with a JSON value. */
function mockGeminiVisionJSON(value) {
  getVisionMock().mockResolvedValue(JSON.stringify(value));
}

/** Stub the vision model with a raw string. */
function mockGeminiVisionRaw(text) {
  getVisionMock().mockResolvedValue(text);
}

/** Make the next Gemini call reject, to exercise error paths. */
function mockGeminiError(err) {
  getMock().mockRejectedValue(err instanceof Error ? err : new Error(err));
}

/** Clear call history and queued implementations between tests. */
function resetGemini() {
  getMock().mockReset();
  getVisionMock().mockReset();
}

module.exports = {
  factory, mockGeminiJSON, mockGeminiRaw, mockGeminiVisionJSON, mockGeminiVisionRaw,
  mockGeminiError, resetGemini, getMock, getVisionMock,
};
