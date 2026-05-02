// ...existing code...
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DailyOutput } from "../data/performanceData";

interface Props {
  data: DailyOutput[];
}

export default function LineChartCard({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    tanggal: d.tanggal.length > 5 ? d.tanggal.slice(5) : d.tanggal,
  }));

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        Total Bibit Keluar per Hari
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Tidak ada data</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString("id-ID"), "Bibit"]} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradTotal)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

