import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EssaySheet } from '../src/components/EssaySheet';
import { EssayBackSheet } from '../src/components/EssayBackSheet';

describe('EssaySheet Component', () => {
  it('renders side-by-side landscape 2-up layout on A4 paper by default', () => {
    const html = renderToStaticMarkup(<EssaySheet layout="side-by-side" />);

    // Check landscape dimensions (297mm x 210mm)
    expect(html).toContain('viewBox="0 0 297 210"');
    expect(html).toContain('width="297mm"');
    expect(html).toContain('height="210mm"');
    expect(html).toContain('data-testid="essay-sheet-landscape"');

    // Check Page 1 and Page 2 roles
    expect(html).toContain('data-role="essay-page-1"');
    expect(html).toContain('data-role="essay-page-2"');
    expect(html).toContain('data-role="center-cut-line"');

    // Check Header and Student Info in English
    expect(html).toContain('ESSAY ANSWER SHEET');
    expect(html).toContain('Name:');
    expect(html).toContain('Class:');
    expect(html).toContain('ID:');
    expect(html).toContain('Subject:');
    expect(html).toContain('SCORE');
    expect(html).toContain('TEACHER REMARKS');

    // Check Writing Margins and Footers
    expect(html).toContain('Margin');
    expect(html).toContain('— Page 1 of 2 —');
    expect(html).toContain('— Page 2 of 2 —');
    expect(html).toContain('— End of Exam —');
    expect(html).toContain('✂ - - - FOLD OR CUT LINE - - - ✂');
  });

  it('renders top-bottom portrait 2-up layout on A4 paper when specified', () => {
    const html = renderToStaticMarkup(<EssaySheet layout="top-bottom" />);

    // Check portrait dimensions (210mm x 297mm)
    expect(html).toContain('viewBox="0 0 210 297"');
    expect(html).toContain('width="210mm"');
    expect(html).toContain('height="297mm"');
    expect(html).toContain('data-testid="essay-sheet-portrait"');

    // Check Page 1 and Page 2 roles
    expect(html).toContain('data-role="essay-page-1"');
    expect(html).toContain('data-role="essay-page-2"');
    expect(html).toContain('data-role="middle-cut-line"');

    // Check Header and Student Info in English
    expect(html).toContain('ESSAY ANSWER SHEET');
    expect(html).toContain('Name:');
    expect(html).toContain('Class:');
    expect(html).toContain('ID:');
    expect(html).toContain('Subject:');
    expect(html).toContain('SCORE');
    expect(html).toContain('TEACHER REMARKS');

    // Check Writing Margins and Footers
    expect(html).toContain('Margin');
    expect(html).toContain('— Page 1 of 2 —');
    expect(html).toContain('— Page 2 of 2 —');
    expect(html).toContain('— End of Exam —');
    expect(html).toContain('✂');
  });

  it('renders single full A4 EssayBackSheet with ruled lines only', () => {
    const html = renderToStaticMarkup(<EssayBackSheet isDouble={false} />);

    // Verify A4 portrait dimensions
    expect(html).toContain('viewBox="0 0 210 297"');
    expect(html).toContain('width="210mm"');
    expect(html).toContain('height="297mm"');
    expect(html).toContain('data-testid="essay-back-full"');

    // Verify pure lines only (zero headers, zero rubrics, zero text)
    expect(html).toContain('data-role="ruled-lines"');
    expect(html).not.toContain('<text');
    expect(html).not.toContain('WRITTEN RESPONSE');
    expect(html).not.toContain('SCORE');
  });

  it('renders 2-up double EssayBackSheet with scissor guide for 10/20 MCQ half-sheets', () => {
    const html = renderToStaticMarkup(<EssayBackSheet isDouble={true} />);

    // Verify A4 portrait dimensions
    expect(html).toContain('viewBox="0 0 210 297"');
    expect(html).toContain('width="210mm"');
    expect(html).toContain('height="297mm"');
    expect(html).toContain('data-testid="essay-back-double"');

    // Verify two half-sheets and scissor line
    expect(html).toContain('data-role="essay-back-half-top"');
    expect(html).toContain('data-role="essay-back-half-bottom"');
    expect(html).toContain('data-role="scissor-divider"');
    expect(html).toContain('✂');
  });
});
