"use client"

import { CartesianGrid, Legend, Pie, PieChart, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"

import {
  Card,
  CardContent
} from "@client/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@client/components/ui/chart"

export const description = "An interactive area chart"

const chartData1 = [
  { name: 'Group A', value: 400 },
  { name: 'Group B', value: 300 },
  { name: 'Group C', value: 300 },
  { name: 'Group D', value: 200 },
]
const chartData2 = [
  { name: 'A1', value: 100 },
  { name: 'A2', value: 300 },
  { name: 'B1', value: 100 },
  { name: 'B2', value: 80 },
  { name: 'B3', value: 40 },
  { name: 'B4', value: 30 },
  { name: 'B5', value: 50 },
  { name: 'C1', value: 100 },
  { name: 'C2', value: 200 },
  { name: 'D1', value: 150 },
  { name: 'D2', value: 50 },
]

const chartConfig = {
  // x: {
  //   label: "Stature",
  //   color: "var(--chart-1)",
  // },
  // y: {
  //   label: "Weight",
  //   color: "var(--chart-2)",
  // },
  // z: {
  //   label: "Score",
  //   color: "var(--chart-3)",
  // },
} satisfies ChartConfig

export function PieChartShow() {

  return (
    <Card className="@container/card">
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <PieChart
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />

            <Pie
              data={chartData1}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius="50%"
              fill="#8884d8"
            />
            <Pie
              data={chartData2}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              fill="#82ca9d"
              label
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name, item) => {
                    // You can use the name (dataKey) to check which item is being rendered
                    return `${name} : ${value}`;
                  }}
                />
              }
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
