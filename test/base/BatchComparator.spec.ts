import {
	beforeAll,
	expect,
	it,
} from '@jest/globals';
import path from 'path';
import { rimraf } from 'rimraf';
import { TestStatus } from '@pixdif/model';

import BatchComparator from '../../src/base/BatchComparator';
import type TestReport from '../../src/base/TestReport';
import BatchTask from '../../src/base/BatchTask';

const to = 'output/batch';
const cmp = new BatchComparator(to);

beforeAll(async () => {
	await rimraf(to);
});

it('checks properties', () => {
	expect(cmp.getReportDir()).toBe(to);
	expect(cmp.getCacheDir()).toBeUndefined();
	expect(cmp.getProgress()).toBe(0);
	expect(cmp.getProgressLimit()).toBe(0);
});

it('can change cache directory', () => {
	const a = new BatchComparator(to);
	a.setCacheDir('test');
	expect(a.getCacheDir()).toBe('test');
});

it('cannot execute 0 tasks', async () => {
	await expect(() => cmp.exec()).rejects.toThrowError('Please add one task at least');
});

it('adds tasks', async () => {
	cmp.addTask(new BatchTask({
		name: 'shape to shape',
		expected: 'test/sample/shape.pdf',
		actual: 'test/sample/shape.pdf',
	}));
	cmp.addTask(new BatchTask({
		name: 'shape to square',
		path: 'test/sample/shape-to-square.yaml',
		expected: 'test/sample/shape.pdf',
		actual: 'test/sample/square.pdf',
	}));
	cmp.addTask(new BatchTask({
		name: 'expected not found',
		path: 'test/sample/expected-not-found.yaml',
		expected: 'test/sample/not-found.pdf',
		actual: 'test/sample/square.pdf',
	}));
	cmp.addTask(new BatchTask({
		name: 'actual not found',
		path: 'test/sample/actual-not-found.yaml',
		expected: 'test/sample/shape.pdf',
		actual: 'test/sample/not-found.pdf',
	}));
	cmp.addTask(new BatchTask({
		name: 'fewer pages',
		expected: 'test/sample/logo.pdf',
		actual: 'test/sample/shape.pdf',
	}));
	cmp.addTask(new BatchTask({
		name: 'more pages',
		expected: 'test/sample/square.pdf',
		actual: 'test/sample/logo.pdf',
	}));
});

let report: TestReport;

it('compares PDF files', async () => {
	report = await cmp.exec();
}, 20 * 1000);

it('can correctly show matched pages', () => {
	const testCase = report.get(0);
	const imageDir = 'image/shape to shape';
	const shapeFile = path.normalize('../../test/sample/shape.pdf');
	expect(testCase).toEqual({
		name: 'shape to shape',
		expected: shapeFile,
		actual: shapeFile,
		status: TestStatus.Matched,
		details: [
			{
				expected: path.join(imageDir, 'expected/1.png'),
				diff: path.join(imageDir, '1.png'),
				actual: path.join(imageDir, 'actual/1.png'),
				name: 'Page 1',
				ratio: 0,
			},
		],
	});
});

it('can tell differences', () => {
	const testCase = report.get(1);
	expect(testCase?.name).toBe('shape to square');
	expect(testCase?.path).toBe(path.normalize('../../test/sample/shape-to-square.yaml'));
	expect(testCase?.expected).toBe(path.normalize('../../test/sample/shape.pdf'));
	expect(testCase?.actual).toBe(path.normalize('../../test/sample/square.pdf'));
	expect(testCase?.status).toBe(TestStatus.Mismatched);

	const details = testCase?.details;
	expect(details).toHaveLength(1);
	expect(details?.[0].ratio).toBeGreaterThan(0);
});

it('skips comparing if expected file is not found', () => {
	const testCase = report.get(2);
	expect(testCase?.name).toBe('expected not found');
	expect(testCase?.status).toBe(TestStatus.ExpectedNotFound);

	const imageDir = 'image/test/sample/expected-not-found';
	const details = testCase?.details;
	expect(details).toHaveLength(1);
	expect(details?.[0]).toEqual({
		expected: path.join(imageDir, 'expected/1.png'),
		diff: path.join(imageDir, '1.png'),
		actual: path.join(imageDir, 'actual/1.png'),
		name: 'Page 1',
		ratio: 1,
	});
});

it('skips comparing if actual file is not found', () => {
	const testCase = report.get(3);
	expect(testCase?.name).toBe('actual not found');
	expect(testCase?.status).toBe(TestStatus.ActualNotFound);

	const imageDir = 'image/test/sample/actual-not-found';
	const details = testCase?.details;
	expect(details).toHaveLength(1);
	expect(details?.[0]).toEqual({
		expected: path.join(imageDir, 'expected/1.png'),
		diff: path.join(imageDir, '1.png'),
		actual: path.join(imageDir, 'actual/1.png'),
		name: 'Page 1',
		ratio: 1,
	});
});

it('can handle fewer pages than expected', () => {
	const testCase = report.get(4);
	expect(testCase?.name).toBe('fewer pages');
	expect(testCase?.status).toBe(TestStatus.Mismatched);

	const imageDir = 'image/fewer pages';
	const details = testCase?.details;
	expect(details).toHaveLength(2);
	expect(details?.[1]).toEqual({
		expected: path.join(imageDir, 'expected/2.png'),
		diff: path.join(imageDir, '2.png'),
		actual: path.join(imageDir, 'actual/2.png'),
		name: 'Page 2',
		ratio: 1,
	});
});

it('can handle more pages than expected', () => {
	const testCase = report.get(5);
	expect(testCase?.name).toBe('more pages');
	expect(testCase?.status).toBe(TestStatus.Mismatched);

	const imageDir = 'image/more pages';
	const details = testCase?.details;
	expect(details).toHaveLength(2);
	expect(details?.[1]).toEqual({
		expected: path.join(imageDir, 'expected/2.png'),
		diff: path.join(imageDir, '2.png'),
		actual: path.join(imageDir, 'actual/2.png'),
		name: 'Page 2',
		ratio: 1,
	});
});

it('generates a report', async () => {
	report.setTitle('Sample Report');
	expect(report.getTitle()).toBe('Sample Report');
	report.setFormat('@pixdif/html-reporter');
	await report.save();
});
