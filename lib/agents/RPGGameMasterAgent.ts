 import { LLMAgent } from '../core/LLMAgent';
 import { Task, Chunk, ChunkType } from '../../interfaces/AgentTypes';
 import { AgentEvaluator, CopyChunksOption } from '../evaluators/AgentEvaluator';
 import { AnswerQuestionsEvaluator } from '../evaluators/AnswerQuestionsEvaluator';
 import { CombatAgent } from './CombatAgent';
 import { MathAgent } from './MathAgent';
 import { DieRollerAgent } from './DieRollerAgent';

 export class RPGGameMasterAgent extends LLMAgent {
     public supportsContinuation: boolean = true;

     constructor(streamingLLM: any, arena: any) {
         super(streamingLLM, arena);
         // Set up evaluators for dynamic agent loading
          const answerQuestionsEvaluator = new AnswerQuestionsEvaluator(
              {
                  'isCombatScenario': 'Is the user input describing a combat encounter or battle situation?',
                  'requiresMath': 'Does the user input require mathematical calculations, dice rolls, or numerical operations?',
                  'requiresDiceRoll': 'Does the user input require rolling dice?'
              },
              [ChunkType.Input]
          );
          const combatEvaluator = new AgentEvaluator(
              (streamingLLM, arena) => new CombatAgent(streamingLLM, arena),
              streamingLLM,
              [ChunkType.Input],
              async (chunk: Chunk, arena: any, agent?: any) => {
                  const answers = chunk.annotations?.['evaluators.AnswerQuestionsEvaluator']?.answers || {};
                  return answers['isCombatScenario'] === true;
              },
              CopyChunksOption.LAST_LLMOUTPUT,
              (chunk: Chunk, arena: any, agent?: any) => [chunk]
          );
           const mathEvaluator = new AgentEvaluator(
              (streamingLLM, arena) => new MathAgent(streamingLLM, arena),
              streamingLLM,
              [ChunkType.Input],
              async (chunk: Chunk, arena: any, agent?: any) => {
                  const answers = chunk.annotations?.['evaluators.AnswerQuestionsEvaluator']?.answers || {};
                  return answers['requiresMath'] === true;
              },
              CopyChunksOption.LAST_LLMOUTPUT,
              (chunk: Chunk, arena: any, agent?: any) => {
                  const original = [chunk];
                  const rollChunks = agent?.currentTask?.scratchpad?.filter((c: Chunk) => c.producer === 'agents.DieRollerAgent') || [];
                  return [...original, ...rollChunks];
              }
          );
          const dieRollerEvaluator = new AgentEvaluator(
              (streamingLLM, arena) => new DieRollerAgent(streamingLLM, arena),
              streamingLLM,
              [ChunkType.Input],
              async (chunk: Chunk, arena: any, agent?: any) => {
                  const answers = chunk.annotations?.['evaluators.AnswerQuestionsEvaluator']?.answers || {};
                  return answers['requiresDiceRoll'] === true;
              },
              CopyChunksOption.LAST_LLMOUTPUT,
              (chunk: Chunk, arena: any, agent?: any) => [chunk]
          );
          this.evaluators = [[answerQuestionsEvaluator, dieRollerEvaluator, mathEvaluator, combatEvaluator]];
     }

     async buildPrompt(task: Task): Promise<string> {
         const scratchpadContent = this.getScratchpadContent(task);
         const currentInput = this.getInputText(task);

         let prompt = `You are the RPGGameMasterAgent, the ultimate Game Master for tabletop RPG adventures.

 Current player input: ${currentInput}

 Adventure history (scratchpad):
 ${scratchpadContent}

  Combat encounters, mathematical calculations, and dice rolls are handled automatically by specialized sub-agents.

 As the Game Master, you control the narrative, describe scenes vividly, manage NPC interactions, and ensure an immersive RPG experience. Respond to player actions, advance the plot, and maintain game balance. Always stay in character and create engaging, memorable moments.`;

         return prompt;
     }
 }