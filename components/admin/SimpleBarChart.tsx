type BarItem = {
  label: string;
  value: number;
};

type Props = {
  title: string;
  items: BarItem[];
  emptyMessage?: string;
};

export default function SimpleBarChart({ title, items, emptyMessage = 'No data yet' }: Props) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{item.label}</span>
                <span className="tabular-nums font-medium text-gray-900">{item.value.toLocaleString('en-GB')}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${Math.max(2, (item.value / max) * 100)}%`,
                    backgroundColor: '#0f1f3d',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
