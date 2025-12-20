import { Chunk, ChunkType } from '../../interfaces/AgentTypes';
import { Evaluator } from '../core/Evaluator';

interface ParsedMarkdownItem {
  type: 'text' | 'quote' | 'bold' | 'emphasis' | 'code' | 'tool_call' | 'tool_result' | 'reasoning';
  content: string;
  start: number;
  end: number;
}

export class MarkdownEvaluator extends Evaluator {
  readonly fqdn: string = 'evaluators.MarkdownEvaluator';
  readonly supportedChunkTypes: ChunkType[] = [ChunkType.LlmOutput];

  async evaluate(chunk: Chunk): Promise<{ annotation?: any, annotations?: Record<string, any> }> {
    const parsed = this.parseMarkdownWithPositions(chunk.content);
    return { annotation: { parsedMarkdown: parsed } };
  }

  private parseMarkdownWithPositions(text: string): ParsedMarkdownItem[] {
    const result: ParsedMarkdownItem[] = [];
    const toolCallTag = '<|tool_call|>';
    const toolCallEndTag = '<|tool_call_end|>';
    const toolResultTag = '<|tool_result|>';
    const toolResultEndTag = '<|tool_result_end|>';
    const reasoningTag = '<reasoning>';
    const reasoningEndTag = '</reasoning>';
    let pos = 0;
    while (pos < text.length) {
      let callStart = text.indexOf(toolCallTag, pos);
      let resultStart = text.indexOf(toolResultTag, pos);
      let reasoningStart = text.indexOf(reasoningTag, pos);
      let earliest = Math.min(
        callStart !== -1 ? callStart : Infinity,
        resultStart !== -1 ? resultStart : Infinity,
        reasoningStart !== -1 ? reasoningStart : Infinity
      );
      if (earliest === Infinity) {
        const plainText = text.slice(pos);
        if (plainText) {
          result.push({ type: 'text', content: plainText, start: pos, end: text.length });
        }
        break;
      }
      if (earliest === callStart) {
        if (callStart > pos) {
          const plainText = text.slice(pos, callStart);
          result.push({ type: 'text', content: plainText, start: pos, end: callStart });
        }
        let callEnd = text.indexOf(toolCallEndTag, callStart);
        if (callEnd === -1) {
          const plainText = text.slice(callStart);
          result.push({ type: 'text', content: plainText, start: callStart, end: text.length });
          break;
        }
        let json = text.slice(callStart + toolCallTag.length, callEnd);
        try {
          const toolCall = JSON.parse(json);
          result.push({ type: 'tool_call', content: json, start: callStart, end: callEnd + toolCallEndTag.length });
        } catch (e) {
          const plainText = text.slice(callStart, callEnd + toolCallEndTag.length);
          result.push({ type: 'text', content: plainText, start: callStart, end: callEnd + toolCallEndTag.length });
        }
        pos = callEnd + toolCallEndTag.length;
      } else if (earliest === resultStart) {
        if (resultStart > pos) {
          const plainText = text.slice(pos, resultStart);
          result.push({ type: 'text', content: plainText, start: pos, end: resultStart });
        }
        let resultEnd = text.indexOf(toolResultEndTag, resultStart);
        if (resultEnd === -1) {
          const plainText = text.slice(resultStart);
          result.push({ type: 'text', content: plainText, start: resultStart, end: text.length });
          break;
        }
        let json = text.slice(resultStart + toolResultTag.length, resultEnd);
        try {
          const toolResult = JSON.parse(json);
          result.push({ type: 'tool_result', content: json, start: resultStart, end: resultEnd + toolResultEndTag.length });
        } catch (e) {
          const plainText = text.slice(resultStart, resultEnd + toolResultEndTag.length);
          result.push({ type: 'text', content: plainText, start: resultStart, end: resultEnd + toolResultEndTag.length });
        }
        pos = resultEnd + toolResultEndTag.length;
      } else if (earliest === reasoningStart) {
        if (reasoningStart > pos) {
          const plainText = text.slice(pos, reasoningStart);
          result.push({ type: 'text', content: plainText, start: pos, end: reasoningStart });
        }
        let reasoningEnd = text.indexOf(reasoningEndTag, reasoningStart);
        if (reasoningEnd === -1) {
          const plainText = text.slice(reasoningStart);
          result.push({ type: 'text', content: plainText, start: reasoningStart, end: text.length });
          break;
        }
        let reasoningText = text.slice(reasoningStart + reasoningTag.length, reasoningEnd);
        result.push({ type: 'reasoning', content: reasoningText, start: reasoningStart, end: reasoningEnd + reasoningEndTag.length });
        pos = reasoningEnd + reasoningEndTag.length;
      }
    }
    // Now parse the text parts for markdown
    const finalResult: ParsedMarkdownItem[] = [];
    for (const item of result) {
      if (item.type === 'text') {
        finalResult.push(...this.parseMarkdownText(item.content, item.start));
      } else {
        finalResult.push(item);
      }
    }
    return finalResult;
  }

  private parseMarkdownText(text: string, offset: number): ParsedMarkdownItem[] {
    const result: ParsedMarkdownItem[] = [];
    let pos = 0;
    const patterns = [
      { regex: /"([^"]*)"/g, type: 'quote' as const },
      { regex: /\*\*([^*]*)\*\*/g, type: 'bold' as const },
      { regex: /\*([^*]*)\*/g, type: 'emphasis' as const },
      { regex: /(?<!\w)_([^_]+)_(?!\w)/g, type: 'emphasis' as const },
      { regex: /`([^`]*)`/g, type: 'code' as const }
    ];
    while (pos < text.length) {
      let earliestMatch: { match: RegExpExecArray; type: string; regex: RegExp } | null = null;
      let earliestIndex = text.length;
      for (const { regex, type } of patterns) {
        regex.lastIndex = pos;
        const match = regex.exec(text);
        if (match && match.index < earliestIndex) {
          earliestMatch = { match, type, regex };
          earliestIndex = match.index;
        }
      }
      if (!earliestMatch) {
        const plain = text.slice(pos);
        if (plain) {
          result.push({ type: 'text', content: plain, start: offset + pos, end: offset + text.length });
        }
        break;
      }
      if (earliestMatch.match.index > pos) {
        const plain = text.slice(pos, earliestMatch.match.index);
        result.push({ type: 'text', content: plain, start: offset + pos, end: offset + earliestMatch.match.index });
      }
      result.push({
        type: earliestMatch.type,
        content: earliestMatch.match[1],
        start: offset + earliestMatch.match.index,
        end: offset + earliestMatch.regex.lastIndex
      });
      pos = earliestMatch.regex.lastIndex;
    }
    return result;
  }
}