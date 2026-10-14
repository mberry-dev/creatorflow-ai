import { render, screen } from '@testing-library/react';
import AnalyticsDashboard from './AnalyticsDashboard';

// Reads the big number on a stat card by its label.
const statFor = (label) => screen.getByText(label).nextSibling.textContent;

describe('AnalyticsDashboard', () => {
  test('shows zeros and 0% for an empty vault', () => {
    render(<AnalyticsDashboard savedAssets={[]} />);
    expect(statFor('Total Assets Saved')).toBe('0');
    expect(statFor('Titles Generated')).toBe('0');
    expect(screen.getByText('0 items (0%)', { selector: '.text-cyan-400' })).toBeInTheDocument();
  });

  test('counts each category and calculates percentages of the total', () => {
    const assets = [
      { category: 'Title' }, { category: 'Title' },
      { category: 'Description' },
      { category: 'Hashtags' },
    ];
    render(<AnalyticsDashboard savedAssets={assets} />);
    expect(statFor('Total Assets Saved')).toBe('4');
    expect(statFor('Titles Generated')).toBe('2');
    expect(statFor('Descriptions Saved')).toBe('1');
    expect(screen.getByText('2 items (50%)')).toBeInTheDocument();
    expect(screen.getByText('50% of total assets')).toBeInTheDocument();
  });

  test('combines Hashtags and SEO Keywords in the "Hashtags & SEO Sets" card', () => {
    const assets = [{ category: 'Hashtags' }, { category: 'SEO Keywords' }, { category: 'Title' }];
    render(<AnalyticsDashboard savedAssets={assets} />);
    expect(statFor('Hashtags & SEO Sets')).toBe('2');
    expect(screen.getByText('67% of total assets')).toBeInTheDocument();
  });

  test('counts uncategorized assets in the total but not in any category', () => {
    render(<AnalyticsDashboard savedAssets={[{}, { category: 'Title' }]} />);
    expect(statFor('Total Assets Saved')).toBe('2');
    expect(statFor('Titles Generated')).toBe('1');
  });

  test('sets each progress bar width to its percentage', () => {
    const { container } = render(<AnalyticsDashboard savedAssets={[{ category: 'Title' }, { category: 'Description' }]} />);
    expect(container.querySelector('.bg-cyan-400.h-full')).toHaveStyle('width: 50%');
    expect(container.querySelector('.bg-amber-400.h-full')).toHaveStyle('width: 0%');
  });
});
