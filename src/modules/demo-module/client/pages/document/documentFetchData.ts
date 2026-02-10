import { SortingState } from "@tanstack/react-table"
import axios from "axios"
import { toast } from "sonner";

export type Document = {
  id: string;
  name: string;
  code: string;
  releaseDate: string;
  pages: number;
}

const range = (len: number) => {
  const arr: number[] = []
  for (let i = 0; i < len; i++) {
    arr.push(i)
  }
  return arr
}

export async function fetchData(options: {
  pageIndex: number
  pageSize: number
}, sorting: SortingState, filter: string) {
  // Simulate some network latency
  await new Promise(r => setTimeout(r, 500))

  const data = await axios.get('/api/modules/demo-module/document', {
    params: {
      page: options.pageIndex + 1,
      perPage: options.pageSize,
      sort: sorting.length > 0 ? sorting.map((item) => item.id)[0] : 'code',
      order: sorting.length > 0 ? (sorting.map((item) => item.desc ? 'desc' : 'asc')[0] || 'asc') : 'asc',
      filter: filter || '',
    }
  })
    .then(response => response.data || undefined)
    .catch(error => {
      console.error(error);
      toast.error("Failed to fetch documents : "  + (error?.message ? `: ${error.message}` : ' Server error'));
    })
    .finally(() => {
      // setLoading(false);
    });

  return {
    rows: data.documents,
    pageCount: Math.ceil(data.count / options.pageSize),
    rowCount: data.count || 0,
  }

}