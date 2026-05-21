import { describe, it, expect } from 'vitest';
import { SCHEMA_DEFINITIONS } from '../../src/constants/schema-definitions.js';

describe('SCHEMA_DEFINITIONS', () => {
    describe('architecture', () => {
        it('has title and description', () => {
            expect(SCHEMA_DEFINITIONS.architecture.title).toBeTruthy();
            expect(SCHEMA_DEFINITIONS.architecture.description).toBeTruthy();
        });

        it('topLevel includes required fields', () => {
            const names = SCHEMA_DEFINITIONS.architecture.topLevel.map(f => f.name);
            expect(names).toContain('councilName');
            expect(names).toContain('nodes');
            expect(names).toContain('edges');
        });

        it('every ITSystem field has name, type, and description', () => {
            for (const field of SCHEMA_DEFINITIONS.architecture.nodeTypes.ITSystem.fields) {
                expect(field.name).toBeTruthy();
                expect(field.type).toBeTruthy();
                expect(field.description).toBeTruthy();
            }
        });

        it('every field with enum also has enumDescriptions with matching keys', () => {
            for (const field of SCHEMA_DEFINITIONS.architecture.nodeTypes.ITSystem.fields) {
                if (field.enum) {
                    expect(field.enumDescriptions).toBeDefined();
                    for (const val of field.enum) {
                        expect(field.enumDescriptions[val]).toBeTruthy();
                    }
                }
            }
        });

        it('no duplicate field names within ITSystem', () => {
            const names = SCHEMA_DEFINITIONS.architecture.nodeTypes.ITSystem.fields.map(f => f.name);
            expect(new Set(names).size).toBe(names.length);
        });

        it('no duplicate field names within Function', () => {
            const names = SCHEMA_DEFINITIONS.architecture.nodeTypes.Function.fields.map(f => f.name);
            expect(new Set(names).size).toBe(names.length);
        });

        it('example has required top-level fields', () => {
            const ex = SCHEMA_DEFINITIONS.architecture.example;
            expect(ex.councilName).toBeTruthy();
            expect(Array.isArray(ex.nodes)).toBe(true);
            expect(Array.isArray(ex.edges)).toBe(true);
            expect(ex.nodes.length).toBeGreaterThan(0);
            expect(ex.edges.length).toBeGreaterThan(0);
        });

        it('example nodes have correct types', () => {
            const ex = SCHEMA_DEFINITIONS.architecture.example;
            const fn = ex.nodes.find(n => n.type === 'Function');
            const sys = ex.nodes.find(n => n.type === 'ITSystem');
            expect(fn).toBeDefined();
            expect(fn.lgaFunctionId).toBeTruthy();
            expect(sys).toBeDefined();
            expect(sys.vendor).toBeTruthy();
        });

        it('edgeTypes defines REALIZES and CONSUMES_CAPABILITY', () => {
            expect(SCHEMA_DEFINITIONS.architecture.edgeTypes.REALIZES).toBeDefined();
            expect(SCHEMA_DEFINITIONS.architecture.edgeTypes.CONSUMES_CAPABILITY).toBeDefined();
        });
    });

    describe('transitionConfig', () => {
        it('has title and description', () => {
            expect(SCHEMA_DEFINITIONS.transitionConfig.title).toBeTruthy();
            expect(SCHEMA_DEFINITIONS.transitionConfig.description).toBeTruthy();
        });

        it('topLevel includes vestingDate and successors', () => {
            const names = SCHEMA_DEFINITIONS.transitionConfig.topLevel.map(f => f.name);
            expect(names).toContain('vestingDate');
            expect(names).toContain('successors');
        });

        it('successorFields includes name as required', () => {
            const nameField = SCHEMA_DEFINITIONS.transitionConfig.successorFields.find(f => f.name === 'name');
            expect(nameField).toBeDefined();
            expect(nameField.required).toBe(true);
        });

        it('example has required fields', () => {
            const ex = SCHEMA_DEFINITIONS.transitionConfig.example;
            expect(ex.vestingDate).toBeTruthy();
            expect(Array.isArray(ex.successors)).toBe(true);
            expect(ex.successors.length).toBeGreaterThan(0);
            expect(ex.successors[0].name).toBeTruthy();
        });
    });
});
