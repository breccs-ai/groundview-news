type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export default function StatCard({ label, value, hint }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
