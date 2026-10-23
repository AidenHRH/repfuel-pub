import { render, screen } from '@testing-library/react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { MeterRow } from '@/components/charts/MeterRow';
import { Sparkline } from '@/components/charts/Sparkline';
import { ThemeProvider } from '@/theme/ThemeProvider';

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
/** Every drawn node of a kind (e.g. 'Circle') in the rendered tree. */
function nodes(tree: unknown, kind: string): Node[] {
  const out: Node[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as Node;
    if (node.type.includes(kind)) out.push(node);
    node.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

const wrap = async (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

test('a line chart is one image with its summary, and dots where colours are given', async () => {
  const { toJSON } = await wrap(
    <LineChart
      values={[86, null, 90, 96]}
      dotColors={['#f00', null, '#0f0', '#00f']}
      color="#6CB4FF"
      accessibilityLabel="1RM rising from 86 to 96 kg"
      xTicks={[{ i: 0, label: 'Aug' }]}
    />,
  );
  const chart = screen.getByLabelText('1RM rising from 86 to 96 kg');
  expect(chart.props.accessibilityRole).toBe('image');
  expect(nodes(toJSON(), 'Circle')).toHaveLength(3);
  expect(JSON.stringify(toJSON())).toContain('"Aug"');
});

test('a bar chart skips empty weeks and fades the ones asked', async () => {
  const { toJSON } = await wrap(
    <BarChart values={[1, 0, 2]} faded={[false, false, true]} color="#6CB4FF" accessibilityLabel="Tonnes a week" />,
  );
  const bars = nodes(toJSON(), 'Rect');
  expect(bars).toHaveLength(2);
  expect(bars[1].props.opacity).toBe(0.4);
});

test('a sparkline needs two points', async () => {
  const { toJSON } = await wrap(<Sparkline values={[null, 5]} color="#0f0" />);
  expect(toJSON()).toBeNull();
});

test('a meter row reads as its label and value', async () => {
  await wrap(<MeterRow label="Chest" value={16} max={20} valueLabel="16" />);
  expect(screen.getByLabelText('Chest, 16')).toBeTruthy();
});
