﻿import { Elements, AttrDef } from './format/Elements';
import { ISieNode, SieNode, SieChildNode } from './format/SieNode';
import {SieFile } from './SieFile';



export const parse = (sieFileData: string): SieFile => {
    const root = new SieFile();
    const lines = sieFileData.split(/\r?\n/);
    const stack = [];
    let cur: ISieNode = root;
    for (const i in lines) {
      cur.poster = cur.poster || [];
      if (lines[i] == '{') {
        stack[stack.length] = cur;
        cur = cur.poster[cur.poster.length - 1];
      } else if (lines[i] == '}') {
        cur = stack.pop();
      } else if (lines[i].match(/\s*#/)) {
        cur.poster[cur.poster.length] = parseLine(lines[i].replace(/^\s*/, '').replace(/\s*$/, ''));
      }
    }
    return root;
  }

const parseLine = (line: string): SieNode => {
  const tokens = tokenizeLine(line);
  if (tokens[0]?.type !== TokenType.ELEMENT) throw new Error('Syntax error');
  const etikett = tokens[0].value.replace(/^#/, '').toLowerCase();
  const row = {
    etikett,
  } as SieChildNode;
  return parseAttrs(row, tokens.slice(1));
}

const enum TokenType { ELEMENT = '#', BEGINARRAY = '{', ENDARRAY = '}', STRING = '"', ARRAY = '{}' };

type ValueToken = { type: TokenType.ELEMENT | TokenType.STRING, value: string };
type ArrayToken = { type: TokenType.ARRAY, value: Record<string, any>[] }
type Token = { type: Exclude<TokenType, TokenType.ELEMENT | TokenType.STRING | TokenType.ARRAY> }
           | ValueToken | ArrayToken;


const tokenizeLine = (line: string): Token[] => {
  const tokens: Token[] = [];
  let consume = false;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (consume) {
      if (quoted) {
        if (line[i] == '\\' && (i + 1) < line.length && line[i + 1] == '"') {
          (tokens[tokens.length - 1] as ValueToken).value += line[++i];
        } else {
          quoted = consume = (line[i] != '"');
          if (consume) {
            (tokens[tokens.length - 1] as ValueToken).value += line[i];
          }
        }
      } else {
        consume = (line[i] != ' ' && line[i] != '\t' && line[i] != '}');
        if (consume) {
          (tokens[tokens.length - 1] as ValueToken).value += line[i];
        } else if (line[i] == '}') {
          tokens[tokens.length] = { type: TokenType.ENDARRAY };
        }
      }
    } else if (line[i] == '#') {
      consume = true;
      tokens[tokens.length] = { type: TokenType.ELEMENT, value: '' };
    } else if (line[i] == '{') {
      tokens[tokens.length] = { type: TokenType.BEGINARRAY };
    } else if (line[i] == '}') {
      tokens[tokens.length] = { type: TokenType.ENDARRAY };
    } else if (line[i] == '"') {
      consume = quoted = true;
      tokens[tokens.length] = { type: TokenType.STRING, value: '' };
    } else if (line[i] != ' ' && line[i] != '\t') {
      consume = true;
      tokens[tokens.length] = { type: TokenType.STRING, value: line[i] };
    }
  }
  return tokens;
}

const parseAttrs = (row: SieChildNode, tokens: Token[]) => {
      if (Elements[row.etikett]) {
        for (let i = 0; i < Elements[row.etikett].length; i++) {
          const elementAttr = Elements[row.etikett][i];
          if (typeof elementAttr === 'object') {
            parseArray(tokens, i, elementAttr);
            addAttr(row, elementAttr.name, tokens, i);
          } else {
            addAttr(row, elementAttr, tokens, i);
          }
        }
      }
      return row as SieNode;
    }

    const parseArray = (tokens: Token[], start: number, attrDef: AttrDef) => {

      for (let i = start + 1; i < tokens.length; i++) {
        if (tokens[i].type == TokenType.ENDARRAY) {
          tokens[start] = { type: TokenType.ARRAY, value: valuesOnly(tokens.splice(start, i - start).slice(1)) } as ArrayToken;
          const startToken = tokens[start] as ArrayToken;
          const a = [];
          for (let j = 0; j < (startToken.value.length - attrDef.type.length + 1); j += attrDef.type.length) {
            const o: Record<string, any> = {};
            for (let k = 0; k < attrDef.type.length; k++) {
              o[attrDef.type[k]] = startToken.value[j + k];
            }
            a[a.length] = o;
          }
          (tokens[start] as ArrayToken).value = (attrDef.many ? a : a[0] ? [a[0]] : []);
        }
      }
    }

    const addAttr = <T>(obj: Record<string, any>, attr: string, tokens: Token[], pos: number) => {
      if (pos >= tokens.length) return;
      const token = tokens[pos];
      if ('value' in token) {
        obj[attr] = token.value;
      }
    }

    const valuesOnly = (tokens: Token[]) => tokens.map(t => 'value' in t ? t.value : undefined);

export const list = (scan: SieNode[], etikett: string, attribs?: Record<string, any>) => {
  const list = [];
  const fel = etikett.replace(/^#/, '').toLowerCase();
  for (const i in scan) {
    if (scan[i].etikett == fel) {
      let add = true;
      for (const [name, value] of Object.entries(attribs ?? {})) {
        add = (scan[i][name] && scan[i][name] == value);
      }
      if (add) {
        list[list.length] = scan[i];
      }
    }
  }
  return list;
}


