import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  test('renders the title and subtitle', () => {
    render(<EmptyState title="No marks yet" subtitle="Upload a PDF to get started" />);
    expect(screen.getByText('No marks yet')).toBeInTheDocument();
    expect(screen.getByText('Upload a PDF to get started')).toBeInTheDocument();
  });

  test('renders and wires up the action button when provided', async () => {
    const onAction = jest.fn();
    render(
      <EmptyState title="No data" subtitle="Add some" actionLabel="Add now" onAction={onAction} />
    );
    const button = screen.getByRole('button', { name: /add now/i });
    await userEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('renders no action button when onAction is omitted', () => {
    render(<EmptyState title="No data" subtitle="Nothing here" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
