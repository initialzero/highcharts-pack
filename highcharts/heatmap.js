/**
 * @license Highcharts JS v4.2.1 (2015-12-21)
 *
 * (c) 2011-2014 Torstein Honsi
 *
 * License: www.highcharts.com/license
 */

///////////////////////////////////////////////////////////////////////
//Jaspersoft Updates (look for comment: JASPERSOFT #x)
///////////////////////////////////////////////////////////////////////
// #1 amd-fication
//
// #2 7/16/14, 7/17/14 extend heatmap for canvas rendering, extend tooltip for time series heatmap
//
// #3 7/29/2014 extend styles for reset zoom button
//
// #4 28/12/2015 JRS-6741: adding fix from HC team which was reverted for some reason (haven't provided).
//               here is the ticket on HC: https://github.com/highcharts/highcharts/issues/4816
//               and here is the commit: https://github.com/highcharts/highcharts/commit/ee8d5678df158567a4861ef412a99b796ea4ab0a
//               So, during next upgrade, please, check if this commit was taken back again
//
///////////////////////////////////////////////////////////////////////

/* eslint indent: [2, 4] */
//JASPERSOFT #1
(function (factory, globalScope) {
    "use strict";

    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else if (typeof define === "function" && define.amd) {
        define(["highcharts"], factory);
    } else {
        factory(globalScope.Highcharts);
    }
//END JASPERSOFT #1
}(function (Highcharts) {


    var UNDEFINED,
        Axis = Highcharts.Axis,
        Chart = Highcharts.Chart,
        Color = Highcharts.Color,
        Legend = Highcharts.Legend,
        LegendSymbolMixin = Highcharts.LegendSymbolMixin,
        Series = Highcharts.Series,
        Point = Highcharts.Point,

        defaultOptions = Highcharts.getOptions(),
        each = Highcharts.each,
        extend = Highcharts.extend,
        extendClass = Highcharts.extendClass,
        merge = Highcharts.merge,
        pick = Highcharts.pick,
        seriesTypes = Highcharts.seriesTypes,
        wrap = Highcharts.wrap,
        noop = function () {};

    


    /**
     * The ColorAxis object for inclusion in gradient legends
     */
    var ColorAxis = Highcharts.ColorAxis = function () {
        this.isColorAxis = true;
        this.init.apply(this, arguments);
    };
    extend(ColorAxis.prototype, Axis.prototype);
    extend(ColorAxis.prototype, {
        defaultColorAxisOptions: {
            lineWidth: 0,
            minPadding: 0,
            maxPadding: 0,
            gridLineWidth: 1,
            //JASPERSOFT #4
            //tickPixelInterval: 72,
            //END JASPERSOFT #4
            startOnTick: true,
            endOnTick: true,
            offset: 0,
            marker: {
                animation: {
                    duration: 50
                },
                color: 'gray',
                width: 0.01
            },
            labels: {
                overflow: 'justify'
                //JASPERSOFT #4
                ,rotation: 0
                //END JASPERSOFT #4
            },
            minColor: '#EFEFFF',
            maxColor: '#003875',
            tickLength: 5
        },
        init: function (chart, userOptions) {
            var horiz = chart.options.legend.layout !== 'vertical',
                options;

            // Build the options
            options = merge(this.defaultColorAxisOptions, {
                side: horiz ? 2 : 1,
                //JASPERSOFT #4
                tickPixelInterval: horiz ? 100 : 72,
                //END JASPERSOFT #4
                reversed: !horiz
            }, userOptions, {
                opposite: !horiz,
                showEmpty: false,
                title: null,
                isColor: true
            });

            Axis.prototype.init.call(this, chart, options);

            // Base init() pushes it to the xAxis array, now pop it again
            //chart[this.isXAxis ? 'xAxis' : 'yAxis'].pop();

            // Prepare data classes
            if (userOptions.dataClasses) {
                this.initDataClasses(userOptions);
            }
            this.initStops(userOptions);

            // Override original axis properties
            this.horiz = horiz;
            this.zoomEnabled = false;
        },

        /*
         * Return an intermediate color between two colors, according to pos where 0
         * is the from color and 1 is the to color.
         * NOTE: Changes here should be copied
         * to the same function in drilldown.src.js and solid-gauge-src.js.
         */
        tweenColors: function (from, to, pos) {
            // Check for has alpha, because rgba colors perform worse due to lack of
            // support in WebKit.
            var hasAlpha,
                ret;

            // Unsupported color, return to-color (#3920)
            if (!to.rgba.length || !from.rgba.length) {
                ret = to.input || 'none';

            // Interpolate
            } else {
                from = from.rgba;
                to = to.rgba;
                hasAlpha = (to[3] !== 1 || from[3] !== 1);
                ret = (hasAlpha ? 'rgba(' : 'rgb(') +
                    Math.round(to[0] + (from[0] - to[0]) * (1 - pos)) + ',' +
                    Math.round(to[1] + (from[1] - to[1]) * (1 - pos)) + ',' +
                    Math.round(to[2] + (from[2] - to[2]) * (1 - pos)) +
                    (hasAlpha ? (',' + (to[3] + (from[3] - to[3]) * (1 - pos))) : '') + ')';
            }
            return ret;
        },

        initDataClasses: function (userOptions) {
            var axis = this,
                chart = this.chart,
                dataClasses,
                colorCounter = 0,
                options = this.options,
                len = userOptions.dataClasses.length;
            this.dataClasses = dataClasses = [];
            this.legendItems = [];

            each(userOptions.dataClasses, function (dataClass, i) {
                var colors;

                dataClass = merge(dataClass);
                dataClasses.push(dataClass);
                if (!dataClass.color) {
                    if (options.dataClassColor === 'category') {
                        colors = chart.options.colors;
                        dataClass.color = colors[colorCounter++];
                        // loop back to zero
                        if (colorCounter === colors.length) {
                            colorCounter = 0;
                        }
                    } else {
                        dataClass.color = axis.tweenColors(
                            Color(options.minColor),
                            Color(options.maxColor),
                            len < 2 ? 0.5 : i / (len - 1) // #3219
                        );
                    }
                }
            });
        },

        initStops: function (userOptions) {
            this.stops = userOptions.stops || [
                [0, this.options.minColor],
                [1, this.options.maxColor]
            ];
            each(this.stops, function (stop) {
                stop.color = Color(stop[1]);
            });
        },

        /**
         * Extend the setOptions method to process extreme colors and color
         * stops.
         */
        setOptions: function (userOptions) {
            Axis.prototype.setOptions.call(this, userOptions);

            this.options.crosshair = this.options.marker;
            this.coll = 'colorAxis';
        },

        setAxisSize: function () {
            var symbol = this.legendSymbol,
                chart = this.chart,
                x,
                y,
                width,
                height;

            if (symbol) {
                this.left = x = symbol.attr('x');
                this.top = y = symbol.attr('y');
                this.width = width = symbol.attr('width');
                this.height = height = symbol.attr('height');
                this.right = chart.chartWidth - x - width;
                this.bottom = chart.chartHeight - y - height;

                this.len = this.horiz ? width : height;
                this.pos = this.horiz ? x : y;
            }
        },

        /**
         * Translate from a value to a color
         */
        toColor: function (value, point) {
            var pos,
                stops = this.stops,
                from,
                to,
                color,
                dataClasses = this.dataClasses,
                dataClass,
                i;

            if (dataClasses) {
                i = dataClasses.length;
                while (i--) {
                    dataClass = dataClasses[i];
                    from = dataClass.from;
                    to = dataClass.to;
                    if ((from === UNDEFINED || value >= from) && (to === UNDEFINED || value <= to)) {
                        color = dataClass.color;
                        if (point) {
                            point.dataClass = i;
                        }
                        break;
                    }
                }

            } else {

                if (this.isLog) {
                    value = this.val2lin(value);
                }
                pos = 1 - ((this.max - value) / ((this.max - this.min) || 1));
                i = stops.length;
                while (i--) {
                    if (pos > stops[i][0]) {
                        break;
                    }
                }
                from = stops[i] || stops[i + 1];
                to = stops[i + 1] || from;

                // The position within the gradient
                pos = 1 - (to[0] - pos) / ((to[0] - from[0]) || 1);

                color = this.tweenColors(
                    from.color,
                    to.color,
                    pos
                );
            }
            return color;
        },

        /**
         * Override the getOffset method to add the whole axis groups inside the legend.
         */
        getOffset: function () {
            var group = this.legendGroup,
                sideOffset = this.chart.axisOffset[this.side];

            if (group) {

                // Hook for the getOffset method to add groups to this parent group
                this.axisParent = group;

                // Call the base
                Axis.prototype.getOffset.call(this);

                // First time only
                if (!this.added) {

                    this.added = true;

                    this.labelLeft = 0;
                    this.labelRight = this.width;
                }
                // Reset it to avoid color axis reserving space
                this.chart.axisOffset[this.side] = sideOffset;
            }
        },

        /**
         * Create the color gradient
         */
        setLegendColor: function () {
            var grad,
                horiz = this.horiz,
                options = this.options,
                reversed = this.reversed,
                one = reversed ? 1 : 0,
                zero = reversed ? 0 : 1;

            grad = horiz ? [one, 0, zero, 0] : [0, zero, 0, one]; // #3190
            this.legendColor = {
                linearGradient: { x1: grad[0], y1: grad[1], x2: grad[2], y2: grad[3] },
                stops: options.stops || [
                    [0, options.minColor],
                    [1, options.maxColor]
                ]
            };
        },

        /**
         * The color axis appears inside the legend and has its own legend symbol
         */
        drawLegendSymbol: function (legend, item) {
            var padding = legend.padding,
                legendOptions = legend.options,
                horiz = this.horiz,
                width = pick(legendOptions.symbolWidth, horiz ? 200 : 12),
                height = pick(legendOptions.symbolHeight, horiz ? 12 : 200),
                labelPadding = pick(legendOptions.labelPadding, horiz ? 16 : 30),
                itemDistance = pick(legendOptions.itemDistance, 10);

            this.setLegendColor();

            // Create the gradient
            item.legendSymbol = this.chart.renderer.rect(
                0,
                legend.baseline - 11,
                width,
                height
            ).attr({
                zIndex: 1
            }).add(item.legendGroup);

            // Set how much space this legend item takes up
            this.legendItemWidth = width + padding + (horiz ? itemDistance : labelPadding);
            this.legendItemHeight = height + padding + (horiz ? labelPadding : 0);
        },
        /**
         * Fool the legend
         */
        setState: noop,
        visible: true,
        setVisible: noop,
        getSeriesExtremes: function () {
            var series;
            if (this.series.length) {
                series = this.series[0];
                this.dataMin = series.valueMin;
                this.dataMax = series.valueMax;
            }
        },
        drawCrosshair: function (e, point) {
            var plotX = point && point.plotX,
                plotY = point && point.plotY,
                crossPos,
                axisPos = this.pos,
                axisLen = this.len;

            if (point) {
                crossPos = this.toPixels(point[point.series.colorKey]);
                if (crossPos < axisPos) {
                    crossPos = axisPos - 2;
                } else if (crossPos > axisPos + axisLen) {
                    crossPos = axisPos + axisLen + 2;
                }

                point.plotX = crossPos;
                point.plotY = this.len - crossPos;
                Axis.prototype.drawCrosshair.call(this, e, point);
                point.plotX = plotX;
                point.plotY = plotY;

                if (this.cross) {
                    this.cross
                        .attr({
                            fill: this.crosshair.color
                        })
                        .add(this.legendGroup);
                }
            }
        },
        getPlotLinePath: function (a, b, c, d, pos) {
            return typeof pos === 'number' ? // crosshairs only // #3969 pos can be 0 !!
                (this.horiz ?
                    ['M', pos - 4, this.top - 6, 'L', pos + 4, this.top - 6, pos, this.top, 'Z'] :
                    ['M', this.left, pos, 'L', this.left - 6, pos + 6, this.left - 6, pos - 6, 'Z']
                ) :
                Axis.prototype.getPlotLinePath.call(this, a, b, c, d);
        },

        update: function (newOptions, redraw) {
            var chart = this.chart,
                legend = chart.legend;

            each(this.series, function (series) {
                series.isDirtyData = true; // Needed for Axis.update when choropleth colors change
            });

            // When updating data classes, destroy old items and make sure new ones are created (#3207)
            if (newOptions.dataClasses && legend.allItems) {
                each(legend.allItems, function (item) {
                    if (item.isDataClass) {
                        item.legendGroup.destroy();
                    }
                });
                chart.isDirtyLegend = true;
            }

            // Keep the options structure updated for export. Unlike xAxis and yAxis, the colorAxis is
            // not an array. (#3207)
            chart.options[this.coll] = merge(this.userOptions, newOptions);

            Axis.prototype.update.call(this, newOptions, redraw);
            if (this.legendItem) {
                this.setLegendColor();
                legend.colorizeItem(this, true);
            }
        },

        /**
         * Get the legend item symbols for data classes
         */
        getDataClassLegendSymbols: function () {
            var axis = this,
                chart = this.chart,
                legendItems = this.legendItems,
                legendOptions = chart.options.legend,
                valueDecimals = legendOptions.valueDecimals,
                valueSuffix = legendOptions.valueSuffix || '',
                name;

            if (!legendItems.length) {
                each(this.dataClasses, function (dataClass, i) {
                    var vis = true,
                        from = dataClass.from,
                        to = dataClass.to;

                    // Assemble the default name. This can be overridden by legend.options.labelFormatter
                    name = '';
                    if (from === UNDEFINED) {
                        name = '< ';
                    } else if (to === UNDEFINED) {
                        name = '> ';
                    }
                    if (from !== UNDEFINED) {
                        name += Highcharts.numberFormat(from, valueDecimals) + valueSuffix;
                    }
                    if (from !== UNDEFINED && to !== UNDEFINED) {
                        name += ' - ';
                    }
                    if (to !== UNDEFINED) {
                        name += Highcharts.numberFormat(to, valueDecimals) + valueSuffix;
                    }

                    // Add a mock object to the legend items
                    legendItems.push(extend({
                        chart: chart,
                        name: name,
                        options: {},
                        drawLegendSymbol: LegendSymbolMixin.drawRectangle,
                        visible: true,
                        setState: noop,
                        isDataClass: true,
                        setVisible: function () {
                            vis = this.visible = !vis;
                            each(axis.series, function (series) {
                                each(series.points, function (point) {
                                    if (point.dataClass === i) {
                                        point.setVisible(vis);
                                    }
                                });
                            });

                            chart.legend.colorizeItem(this, vis);
                        }
                    }, dataClass));
                });
            }
            return legendItems;
        },
        name: '' // Prevents 'undefined' in legend in IE8
    });

    /**
     * Handle animation of the color attributes directly
     */
    each(['fill', 'stroke'], function (prop) {
        Highcharts.Fx.prototype[prop + 'Setter'] = function () {
            this.elem.attr(prop, ColorAxis.prototype.tweenColors(Color(this.start), Color(this.end), this.pos));
        };
    });

    /**
     * Extend the chart getAxes method to also get the color axis
     */
    wrap(Chart.prototype, 'getAxes', function (proceed) {

        var options = this.options,
            colorAxisOptions = options.colorAxis;

        proceed.call(this);

        this.colorAxis = [];
        if (colorAxisOptions) {
            new ColorAxis(this, colorAxisOptions); // eslint-disable-line no-new
        }
    });


    /**
     * Wrap the legend getAllItems method to add the color axis. This also removes the
     * axis' own series to prevent them from showing up individually.
     */
    wrap(Legend.prototype, 'getAllItems', function (proceed) {
        var allItems = [],
            colorAxis = this.chart.colorAxis[0];

        if (colorAxis) {

            // Data classes
            if (colorAxis.options.dataClasses) {
                allItems = allItems.concat(colorAxis.getDataClassLegendSymbols());
            // Gradient legend
            } else {
                // Add this axis on top
                allItems.push(colorAxis);
            }

            // Don't add the color axis' series
            each(colorAxis.series, function (series) {
                series.options.showInLegend = false;
            });
        }

        return allItems.concat(proceed.call(this));
    });
    /**
     * Mixin for maps and heatmaps
     */
    var colorPointMixin = {
        /**
         * Set the visibility of a single point
         */
        setVisible: function (vis) {
            var point = this,
                method = vis ? 'show' : 'hide';

            // Show and hide associated elements
            each(['graphic', 'dataLabel'], function (key) {
                if (point[key]) {
                    point[key][method]();
                }
            });
        }
    };
    var colorSeriesMixin = {

        pointAttrToOptions: { // mapping between SVG attributes and the corresponding options
            stroke: 'borderColor',
            'stroke-width': 'borderWidth',
            fill: 'color',
            dashstyle: 'dashStyle'
        },
        pointArrayMap: ['value'],
        axisTypes: ['xAxis', 'yAxis', 'colorAxis'],
        optionalAxis: 'colorAxis',
        trackerGroups: ['group', 'markerGroup', 'dataLabelsGroup'],
        getSymbol: noop,
        parallelArrays: ['x', 'y', 'value'],
        colorKey: 'value',

        /**
         * In choropleth maps, the color is a result of the value, so this needs translation too
         */
        translateColors: function () {
            var series = this,
                nullColor = this.options.nullColor,
                colorAxis = this.colorAxis,
                colorKey = this.colorKey;

            each(this.data, function (point) {
                var value = point[colorKey],
                    color;

                color = point.options.color ||
                    (value === null ? nullColor : (colorAxis && value !== undefined) ? colorAxis.toColor(value, point) : point.color || series.color);

                if (color) {
                    point.color = color;
                }
            });
        }
    };

    /**
     * Extend the default options with map options
     */
    defaultOptions.plotOptions.heatmap = merge(defaultOptions.plotOptions.scatter, {
        animation: false,
        borderWidth: 0,
        nullColor: '#F8F8F8',
        dataLabels: {
            formatter: function () { // #2945
                return this.point.value;
            },
            inside: true,
            verticalAlign: 'middle',
            crop: false,
            overflow: false,
            padding: 0 // #3837
        },
        marker: null,
        pointRange: null, // dynamically set to colsize by default
        tooltip: {
            pointFormat: '{point.x}, {point.y}: {point.value}<br/>'
        },
        states: {
            normal: {
                animation: true
            },
            hover: {
                halo: false,  // #3406, halo is not required on heatmaps
                brightness: 0.2
            }
        }
    });

    // The Heatmap series type
    seriesTypes.heatmap = extendClass(seriesTypes.scatter, merge(colorSeriesMixin, {
        type: 'heatmap',
        pointArrayMap: ['y', 'value'],
        hasPointSpecificOptions: true,
        pointClass: extendClass(Point, colorPointMixin),
        supportsDrilldown: true,
        getExtremesFromAll: true,
        directTouch: true,

        /**
         * Override the init method to add point ranges on both axes.
         */
        init: function () {
            var options;
            seriesTypes.scatter.prototype.init.apply(this, arguments);

            options = this.options;
            options.pointRange = pick(options.pointRange, options.colsize || 1); // #3758, prevent resetting in setData
            this.yAxis.axisPointRange = options.rowsize || 1; // general point range

            //JASPERSOFT #2
            var $container = jQuery(this.chart.container),
                $style = $container.find("#jasper_highcharts_css");

            if (this.chart.options.chart.isHeatMapTimeSeriesChart) {
                if ($style.length === 0) {

                    var style = jQuery("<style type='text/css'>" +
                        ".highcharts-tooltip>span {" +
                        "background: rgba(255,255,255,0.85);" +
                        "border: 1px solid silver;" +
                        "border-radius: 3px;" +
                        "box-shadow: 1px 1px 2px #888;" +
                        "padding: 8px;" +
                        "z-index: 2;" +
                        "}" +
                        // JASPERSOFT #3
                        // reset zoom button patch
                        ".highcharts-button>span {" +
                        "background: rgba(255,255,255,0.85);" +
                        "border: 1px solid silver;" +
                        "border-radius: 3px;" +
                        "padding: 5px;" +
                        "z-index: 2;" +
                        "cursor: pointer;" +
                        "}" +
                        ".highcharts-button>span:hover {" +
                        "background: -moz-linear-gradient(top, #ffffff 0%, #aaccff 100%);" +
                        "background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,#ffffff), color-stop(100%,#aaccff));" +
                        "background: -webkit-linear-gradient(top, #ffffff 0%,#aaccff 100%);" +
                        "background: -o-linear-gradient(top, #ffffff 0%,#aaccff 100%);" +
                        "background: -ms-linear-gradient(top, #ffffff 0%,#aaccff 100%);" +
                        "background: linear-gradient(to bottom, #ffffff 0%,#aaccff 100%);" +
                        "filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#ffffff', endColorstr='#aaccff',GradientType=0 );" +
                            //END JASPERSOFT #3
                        "}</style>");

                    style.attr("id", "jasper_highcharts_css");
                    $container.append(style);
                }
            } else {
                $style.length && $style.remove();
            }
            //END JASPERSOFT #2
        },
        translate: function () {
            var series = this,
                options = series.options,
                xAxis = series.xAxis,
                yAxis = series.yAxis,
                between = function (x, a, b) {
                    return Math.min(Math.max(a, x), b);
                };

            series.generatePoints();

            each(series.points, function (point) {
                var xPad = (options.colsize || 1) / 2,
                    yPad = (options.rowsize || 1) / 2,
                    x1 = between(Math.round(xAxis.len - xAxis.translate(point.x - xPad, 0, 1, 0, 1)), 0, xAxis.len),
                    x2 = between(Math.round(xAxis.len - xAxis.translate(point.x + xPad, 0, 1, 0, 1)), 0, xAxis.len),
                    y1 = between(Math.round(yAxis.translate(point.y - yPad, 0, 1, 0, 1)), 0, yAxis.len),
                    y2 = between(Math.round(yAxis.translate(point.y + yPad, 0, 1, 0, 1)), 0, yAxis.len);

                // Set plotX and plotY for use in K-D-Tree and more
                point.plotX = point.clientX = (x1 + x2) / 2;
                point.plotY = (y1 + y2) / 2;

                point.shapeType = 'rect';
                point.shapeArgs = {
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1)
                };
            });

            series.translateColors();

            // Make sure colors are updated on colorAxis update (#2893)
            if (this.chart.hasRendered) {
                each(series.points, function (point) {
                    point.shapeArgs.fill = point.options.color || point.color; // #3311
                });
            }
        },
        //JASPERSOFT #2
        drawPoints: function() {
            var ctx;
            if (this.chart.renderer.forExport || !this.chart.options.chart.isHeatMapTimeSeriesChart) {
                // Run SVG shapes
                seriesTypes.column.prototype.drawPoints.call(this);
            } else {

                if (ctx = this.getContext()) {
                    ctx.canvas.height = this.chart.renderer.plotBox.height;
                    ctx.canvas.width = this.chart.renderer.plotBox.width;

                    // draw the columns
                    Highcharts.each(this.points, function (point) {
                        var plotY = point.plotY,
                            shapeArgs;

                        if (plotY !== undefined && !isNaN(plotY) && point.y !== null) {
                            shapeArgs = point.shapeArgs;

                            ctx.fillStyle = point.pointAttr[''].fill;
                            ctx.fillRect(shapeArgs.x, shapeArgs.y, shapeArgs.width, shapeArgs.height);
                        }
                    });

                } else {
                    this.chart.showLoading("Your browser doesn't support HTML5 canvas, <br>please use a modern browser");

                    // Uncomment this to provide low-level (slow) support in oldIE. It will cause script errors on
                    // charts with more than a few thousand points.
                    //proceed.call(this);
                }
            }
        },
        //END JASPERSOFT #2
        animate: noop,
        getBox: noop,
        drawLegendSymbol: LegendSymbolMixin.drawRectangle,

        getExtremes: function () {
            // Get the extremes from the value data
            Series.prototype.getExtremes.call(this, this.valueData);
            this.valueMin = this.dataMin;
            this.valueMax = this.dataMax;

            // Get the extremes from the y data
            Series.prototype.getExtremes.call(this);
        }
        //JASPERSOFT #2
        , getContext: function () {
            var canvas;

            if (!this.ctx) {
                canvas = document.createElement('canvas'); // TODO use doc context because of iframes ???
                canvas.setAttribute('width', this.chart.plotWidth);
                canvas.setAttribute('height', this.chart.plotHeight);
                canvas.style.position = 'absolute';
                canvas.style.left = this.group.translateX + 'px';
                canvas.style.top = this.group.translateY + 'px';
                canvas.style.zIndex = 0;
                canvas.style.cursor = 'crosshair';

                this.chart.container.appendChild(canvas);
                if (canvas.getContext) {
                    this.ctx = canvas.getContext('2d');
                }
            }
            return this.ctx;
        },
        setTooltipPoints: function() {
            var series = this;

            this.tree = null;
            setTimeout(function() {
                series.tree = KDTree(series.points, 0);
            });
        },
        getNearest: function(search) {
            if (this.tree) {
                return nearest(search, this.tree, 0);
            }
        }
        //END JASPERSOFT #2
    }));

    //JASPERSOFT #2
    Highcharts.wrap(Highcharts.Pointer.prototype, 'runPointActions', function (proceed, e) {
        var chart = this.chart;
        proceed.call(this, e);

        if (!this.chart.options.chart.isHeatMapTimeSeriesChart) {
            return;
        }

        // Draw independent tooltips
        Highcharts.each(chart.series, function (series) {
            var point;
            if (series.getNearest) {
                point = series.getNearest({
                    plotX: e.chartX - chart.plotLeft,
                    plotY: e.chartY - chart.plotTop
                });
                if (point) {
                    point.onMouseOver(e);
                }
            }
        });
    });

    /**
     * Recursively builds a K-D-tree
     */
    function KDTree(points, depth) {
        var axis, median, length = points && points.length;

        if (length) {

            // alternate between the axis
            axis = ['plotX', 'plotY'][depth % 2];

            // sort point array
            points.sort(function(a, b) {
                return a[axis] - b[axis];
            });

            median = Math.floor(length / 2);

            // build and return node
            return {
                point: points[median],
                left: KDTree(points.slice(0, median), depth + 1),
                right: KDTree(points.slice(median + 1), depth + 1)
            };
        }
    }

    /**
     * Recursively searches for the nearest neighbour using the given K-D-tree
     */
    function nearest(search, tree, depth) {
        var point = tree.point,
            axis = ['plotX', 'plotY'][depth % 2],
            tdist,
            sideA,
            sideB,
            ret = point,
            nPoint1,
            nPoint2;

        // Get distance
        point.dist = Math.pow(search.plotX - point.plotX, 2) +
            Math.pow(search.plotY - point.plotY, 2);

        // Pick side based on distance to splitting point
        tdist = search[axis] - point[axis];
        sideA = tdist < 0 ? 'left' : 'right';

        // End of tree
        if (tree[sideA]) {
            nPoint1 = nearest(search, tree[sideA], depth + 1);

            ret = (nPoint1.dist < ret.dist ? nPoint1 : point);

            sideB = tdist < 0 ? 'right' : 'left';
            if (tree[sideB]) {
                // compare distance to current best to splitting point to decide wether to check side B or not
                if (Math.abs(tdist) < ret.dist) {
                    nPoint2 = nearest(search, tree[sideB], depth + 1);
                    ret = (nPoint2.dist < ret.dist ? nPoint2 : ret);
                }
            }
        }
        return ret;
    }
    //END JASPERSOFT #2

//JASPERSOFT #1
    return Highcharts;
}, this));
//END JASPERSOFT #1
