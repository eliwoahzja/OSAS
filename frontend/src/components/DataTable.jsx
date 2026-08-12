export default function DataTable({ title, columns, rows, emptyMessage = 'No records yet.' }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {title && (
        <div className="px-6 pt-5 pb-3.5 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] min-w-[640px]">
          <thead>
            <tr className="bg-gray-50/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-gray-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id ?? i} className="border-t border-gray-100 hover:bg-pink-50/40 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-3.5 text-gray-700 align-top">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
