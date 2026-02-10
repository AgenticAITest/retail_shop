import SortButton from '@client/components/console/SortButton';
import { flexRender } from '@tanstack/react-table';

import type { Header } from '@tanstack/react-table';

export function TarnstackHeader({ header }: { header: Header<any, any> }) {
  // header: TanStack Table header object
  if (header.column.getCanSort()) {
    return (
      <SortButton
        column={header.column.id}
        label={
          typeof header.column.columnDef.header === 'string'
            ? header.column.columnDef.header
            : typeof header.column.columnDef.header === 'function'
              ? header.column.columnDef.header(header.getContext())?.toString()
              : 'Header'
        }
        sort={header.getContext().table.getState().sorting[0]?.id ?? ''}
        order={header.getContext().table.getState().sorting[0]?.desc ? 'desc' : 'asc'}
        sortBy={col => {
          // Toggle sort direction if same column, else set ascending
          const current = header.getContext().table.getState().sorting[0];
          if (current?.id === col) {
            header.getContext().table.setSorting([{ id: col, desc: !current.desc }]);
          } else {
            header.getContext().table.setSorting([{ id: col, desc: false }]);
          }
        }}
      />
    );
  }
  // Not sortable
  return (
    <>
      {flexRender(
        header.column.columnDef.header,
        header.getContext()
      )}
    </>
  );
}