import { describe, it, expect } from 'vitest'
import {
  validateMainToSandboxMessage,
  validateSandboxToMainMessage,
  sanitizeProps,
} from '@/utils/security'

describe('Security Utilities', () => {
  describe('validateMainToSandboxMessage', () => {
    it('should accept valid EXECUTE_CODE message', () => {
      const message = {
        type: 'EXECUTE_CODE',
        payload: { jsxCode: '<div />', hooksCode: '' },
      }

      expect(validateMainToSandboxMessage(message)).toBe(true)
    })

    it('should accept valid UPDATE_VIEWPORT message', () => {
      const message = {
        type: 'UPDATE_VIEWPORT',
        payload: { width: 1024 },
      }

      expect(validateMainToSandboxMessage(message)).toBe(true)
    })

    it('should accept valid TOGGLE_INSPECT message', () => {
      const message = {
        type: 'TOGGLE_INSPECT',
        payload: { enabled: true },
      }

      expect(validateMainToSandboxMessage(message)).toBe(true)
    })

    it('should accept valid GET_INSPECTION_DATA message', () => {
      const message = {
        type: 'GET_INSPECTION_DATA',
        payload: { x: 100, y: 200 },
      }

      expect(validateMainToSandboxMessage(message)).toBe(true)
    })

    it('should reject message with invalid type', () => {
      const message = {
        type: 'MALICIOUS_ACTION',
        payload: {},
      }

      expect(validateMainToSandboxMessage(message)).toBe(false)
    })

    it('should reject message without type', () => {
      const message = {
        payload: {},
      }

      expect(validateMainToSandboxMessage(message)).toBe(false)
    })

    it('should reject non-object message', () => {
      expect(validateMainToSandboxMessage(null)).toBe(false)
      expect(validateMainToSandboxMessage(undefined)).toBe(false)
      expect(validateMainToSandboxMessage('string')).toBe(false)
      expect(validateMainToSandboxMessage(123)).toBe(false)
      expect(validateMainToSandboxMessage([])).toBe(false)
    })
  })

  describe('validateSandboxToMainMessage', () => {
    it('should accept valid RENDER_SUCCESS message', () => {
      const message = {
        type: 'RENDER_SUCCESS',
        payload: {},
      }

      expect(validateSandboxToMainMessage(message)).toBe(true)
    })

    it('should accept valid COMPILE_ERROR message', () => {
      const message = {
        type: 'COMPILE_ERROR',
        payload: {
          message: 'Syntax error',
          line: 5,
          column: 10,
          stack: null,
        },
      }

      expect(validateSandboxToMainMessage(message)).toBe(true)
    })

    it('should accept valid RUNTIME_ERROR message', () => {
      const message = {
        type: 'RUNTIME_ERROR',
        payload: {
          message: 'Cannot read property of undefined',
          componentStack: null,
          stack: 'Error: ...',
        },
      }

      expect(validateSandboxToMainMessage(message)).toBe(true)
    })

    it('should accept valid INSPECTION_DATA message', () => {
      const message = {
        type: 'INSPECTION_DATA',
        payload: {
          componentName: 'Button',
          props: { variant: 'primary' },
          styles: { color: '#000' },
        },
      }

      expect(validateSandboxToMainMessage(message)).toBe(true)
    })

    it('should accept valid CONSOLE_LOG message', () => {
      const message = {
        type: 'CONSOLE_LOG',
        payload: {
          level: 'log',
          args: ['Hello', 'world'],
        },
      }

      expect(validateSandboxToMainMessage(message)).toBe(true)
    })

    it('should reject message with invalid type', () => {
      const message = {
        type: 'EXECUTE_CODE',
        payload: {},
      }

      expect(validateSandboxToMainMessage(message)).toBe(false)
    })

    it('should reject message without type', () => {
      const message = {
        payload: {},
      }

      expect(validateSandboxToMainMessage(message)).toBe(false)
    })

    it('should reject non-object message', () => {
      expect(validateSandboxToMainMessage(null)).toBe(false)
      expect(validateSandboxToMainMessage(undefined)).toBe(false)
      expect(validateSandboxToMainMessage('string')).toBe(false)
      expect(validateSandboxToMainMessage(123)).toBe(false)
    })
  })

  describe('sanitizeProps', () => {
    it('should preserve serializable primitive values', () => {
      const props = {
        string: 'hello',
        number: 42,
        boolean: true,
        nullValue: null,
      }

      const result = sanitizeProps(props)

      expect(result).toEqual(props)
    })

    it('should preserve serializable objects and arrays', () => {
      const props = {
        object: { nested: 'value' },
        array: [1, 2, 3],
      }

      const result = sanitizeProps(props)

      expect(result).toEqual(props)
    })

    it('should remove function props', () => {
      const props = {
        onClick: () => {},
        value: 'keep this',
        handler: function() {},
      }

      const result = sanitizeProps(props)

      expect(result).toEqual({ value: 'keep this' })
      expect(result.onClick).toBeUndefined()
      expect(result.handler).toBeUndefined()
    })

    it('should remove children prop', () => {
      const props = {
        children: 'Some content',
        id: 'button-1',
      }

      const result = sanitizeProps(props)

      expect(result).toEqual({ id: 'button-1' })
      expect(result.children).toBeUndefined()
    })

    it('should mark non-serializable values', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular

      const props = {
        circular,
        normal: 'value',
      }

      const result = sanitizeProps(props)

      expect(result.circular).toBe('[Non-serializable]')
      expect(result.normal).toBe('value')
    })

    it('should handle empty props object', () => {
      const result = sanitizeProps({})
      expect(result).toEqual({})
    })

    it('should handle mixed valid and invalid props', () => {
      const props = {
        id: 'btn-1',
        onClick: () => {},
        disabled: false,
        children: 'Click me',
        className: 'button',
        handler: function() {},
      }

      const result = sanitizeProps(props)

      expect(result).toEqual({
        id: 'btn-1',
        disabled: false,
        className: 'button',
      })
    })
  })
})
