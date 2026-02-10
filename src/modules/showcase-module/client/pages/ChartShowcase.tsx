import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@client/components/ui/card"
import { ChartAreaShow } from './chart/AreaChartShow'
import { ComposedBarChartShow } from './chart/ComposedBarChartShow'
import { HorizontalBarChartShow } from './chart/HorizontalBarChartShow'
import { LineChartShow } from './chart/LineChartShow'
import { StackedBarChartShow } from './chart/StackedBarChartShow'
import { VerticalBarChartShow } from './chart/VerticalBarChartShow'
import { ScatterChartShow } from "./chart/ScatterChartShow"
import { PieChartShow } from "./chart/PieChartShow"
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization"

const ChartShowcase = () => {
  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4" >
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Chart Component</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-8 px-2 py-2 md:gap-10">

          {/* Basic Usage */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Using Recharts Component</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">

              {/* Area Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Area Chart</CardTitle>
                  <CardDescription>
                    {/* All svg elements can be added into the AreaChart component, such as defs, linearGradient, etc.. */}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartAreaShow />
                </CardContent>
              </Card>

              {/* Line Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Line Chart</CardTitle>
                  <CardDescription>
                    {/* &nbsp;<br/>&nbsp; */}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LineChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>


              {/* Vertical Bar Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Vertical Bar Chart</CardTitle>
                  <CardDescription>

                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VerticalBarChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>

              {/* Horizontal Bar Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Horizontal Bar Chart</CardTitle>
                  <CardDescription>

                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>

              {/* Stacked Bar Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Stacked Bar Chart</CardTitle>
                  <CardDescription>

                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StackedBarChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>

              {/* Combo Bar Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Composed Bar Chart</CardTitle>
                  <CardDescription>

                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ComposedBarChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>

              {/* Scatter Chart Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Scatter Chart</CardTitle>
                  <CardDescription>

                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScatterChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>

              {/* Pie Chart Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Pie Chart</CardTitle>
                  <CardDescription>

                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PieChartShow />
                </CardContent>
                <CardFooter className="gap-2">
                </CardFooter>
              </Card>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}

export default withModuleAuthorization(ChartShowcase, {
  moduleId: 'showcase-module',
  moduleName: 'Showcase Module'
});
