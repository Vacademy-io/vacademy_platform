package vacademy.io.assessment_service.features.assessment.service;

import lombok.extern.slf4j.Slf4j;
import org.jfree.chart.ChartFactory;
import org.jfree.chart.JFreeChart;
import org.jfree.chart.plot.SpiderWebPlot;
import org.jfree.chart.plot.CategoryPlot;
import org.jfree.chart.plot.PlotOrientation;
import org.jfree.chart.renderer.category.BarRenderer;
import org.jfree.chart.renderer.category.StandardBarPainter;
import org.jfree.chart.title.LegendTitle;
import org.jfree.data.category.DefaultCategoryDataset;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;

/**
 * Generates chart images (PNG, Base64-encoded) for embedding in PDF reports.
 * Uses JFreeChart for server-side rendering.
 */
@Service
@Slf4j
public class AiReportChartGenerator {

    private static final Color PRIMARY = new Color(0x49, 0x8C, 0xFF);
    private static final Color BG = Color.WHITE;
    private static final Color GRID_COLOR = new Color(0xE0, 0xE0, 0xE0);
    private static final Font LABEL_FONT = new Font("SansSerif", Font.PLAIN, 11);
    private static final Font TITLE_FONT = new Font("SansSerif", Font.BOLD, 13);

    /**
     * Generate a radar/spider chart for topic analysis.
     * @param topicAccuracies Map of topic name → accuracy (0-100)
     * @return Base64-encoded PNG data URI
     */
    public String generateRadarChart(Map<String, Double> topicAccuracies) {
        try {
            DefaultCategoryDataset dataset = new DefaultCategoryDataset();
            for (Map.Entry<String, Double> entry : topicAccuracies.entrySet()) {
                dataset.addValue(entry.getValue(), "Student", entry.getKey());
            }

            SpiderWebPlot plot = new SpiderWebPlot(dataset);
            plot.setSeriesPaint(0, PRIMARY);
            plot.setSeriesOutlineStroke(0, new BasicStroke(2.0f));
            plot.setWebFilled(true);
            plot.setBackgroundPaint(BG);
            plot.setOutlinePaint(null);
            plot.setLabelFont(LABEL_FONT);
            plot.setMaxValue(100.0);
            plot.setInteriorGap(0.3);

            JFreeChart chart = new JFreeChart("", TITLE_FONT, plot, false);
            chart.setBackgroundPaint(BG);

            return chartToBase64(chart, 500, 400);
        } catch (Exception e) {
            log.warn("Failed to generate radar chart: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Generate a horizontal bar chart for Bloom's taxonomy.
     * @param bloomsData Map of level → accuracy (0-100)
     * @return Base64-encoded PNG data URI
     */
    public String generateBloomsBarChart(Map<String, Double> bloomsData) {
        try {
            // Each level as its own series so we can color them individually
            DefaultCategoryDataset dataset = new DefaultCategoryDataset();
            String[] levels = {"Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"};
            Color[] colors = {
                    new Color(0x00, 0xD6, 0x8F), // Remember - green
                    new Color(0x54, 0xA0, 0xFF), // Understand - blue
                    new Color(0x6C, 0x5C, 0xE7), // Apply - purple
                    new Color(0xFE, 0xCA, 0x57), // Analyze - yellow
                    new Color(0xFF, 0x9F, 0x43), // Evaluate - orange
                    new Color(0xFF, 0x6B, 0x6B), // Create - red
            };

            for (int i = 0; i < levels.length; i++) {
                String key = levels[i].toLowerCase();
                double val = bloomsData.getOrDefault(key, 0.0);
                // Use level name as both series and category for individual coloring
                dataset.addValue(val, levels[i], levels[i]);
            }

            JFreeChart chart = ChartFactory.createBarChart(
                    "", "", "Accuracy %",
                    dataset, PlotOrientation.VERTICAL, false, false, false);

            chart.setBackgroundPaint(BG);
            CategoryPlot plot = chart.getCategoryPlot();
            plot.setBackgroundPaint(BG);
            plot.setOutlinePaint(null);
            plot.setRangeGridlinePaint(GRID_COLOR);
            plot.getRangeAxis().setRange(0, 100);
            plot.getRangeAxis().setLabelFont(LABEL_FONT);
            plot.getDomainAxis().setTickLabelFont(LABEL_FONT);

            BarRenderer renderer = (BarRenderer) plot.getRenderer();
            renderer.setBarPainter(new StandardBarPainter());
            renderer.setShadowVisible(false);
            renderer.setMaximumBarWidth(0.5);
            renderer.setItemMargin(0.0);
            plot.getDomainAxis().setCategoryMargin(0.05);
            plot.getDomainAxis().setLowerMargin(0.01);
            plot.getDomainAxis().setUpperMargin(0.01);

            // Color each series (level) with its unique color
            for (int i = 0; i < levels.length; i++) {
                renderer.setSeriesPaint(i, colors[i]);
            }

            return chartToBase64(chart, 500, 280);
        } catch (Exception e) {
            log.warn("Failed to generate Bloom's bar chart: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Generate a grouped bar chart for Bloom's taxonomy (student vs class).
     * @param studentData Map of level → accuracy
     * @param classData Map of level → accuracy (can be null)
     * @return Base64-encoded PNG data URI
     */
    public String generateBloomsComparisonChart(Map<String, Double> studentData, Map<String, Double> classData) {
        try {
            DefaultCategoryDataset dataset = new DefaultCategoryDataset();
            String[] levels = {"Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"};

            for (String level : levels) {
                String key = level.toLowerCase();
                dataset.addValue(studentData.getOrDefault(key, 0.0), "Student", level);
                if (classData != null) {
                    dataset.addValue(classData.getOrDefault(key, 0.0), "Class Avg", level);
                }
            }

            JFreeChart chart = ChartFactory.createBarChart(
                    "", "", "Accuracy %",
                    dataset, PlotOrientation.VERTICAL, true, false, false);

            chart.setBackgroundPaint(BG);
            CategoryPlot plot = chart.getCategoryPlot();
            plot.setBackgroundPaint(BG);
            plot.setOutlinePaint(null);
            plot.setRangeGridlinePaint(GRID_COLOR);
            plot.getRangeAxis().setRange(0, 100);
            plot.getDomainAxis().setTickLabelFont(LABEL_FONT);

            BarRenderer renderer = (BarRenderer) plot.getRenderer();
            renderer.setBarPainter(new StandardBarPainter());
            renderer.setShadowVisible(false);
            renderer.setSeriesPaint(0, PRIMARY);
            renderer.setSeriesPaint(1, new Color(0xCC, 0xCC, 0xCC));

            LegendTitle legend = chart.getLegend();
            if (legend != null) {
                legend.setItemFont(LABEL_FONT);
            }

            return chartToBase64(chart, 500, 280);
        } catch (Exception e) {
            log.warn("Failed to generate Bloom's comparison chart: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Generate a confidence grid as an image.
     * @param questionConfidences Map of question label → confidence % (0-100)
     * @return Base64-encoded PNG data URI
     */
    public String generateConfidenceGrid(Map<String, Integer> questionConfidences) {
        try {
            int cols = 5;
            int rows = (int) Math.ceil(questionConfidences.size() / (double) cols);
            int cellW = 90, cellH = 70, pad = 4;
            int imgW = cols * (cellW + pad) + pad;
            int imgH = rows * (cellH + pad) + pad;

            BufferedImage img = new BufferedImage(imgW, imgH, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = img.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(BG);
            g.fillRect(0, 0, imgW, imgH);

            int idx = 0;
            for (Map.Entry<String, Integer> entry : questionConfidences.entrySet()) {
                int row = idx / cols;
                int col = idx % cols;
                int x = pad + col * (cellW + pad);
                int y = pad + row * (cellH + pad);

                int conf = entry.getValue();
                Color bgColor = conf >= 70 ? new Color(0xE8, 0xF5, 0xE9) :
                        conf >= 40 ? new Color(0xFF, 0xF8, 0xE1) :
                                new Color(0xFF, 0xEB, 0xEE);
                Color textColor = conf >= 70 ? new Color(0x2E, 0x7D, 0x32) :
                        conf >= 40 ? new Color(0xF5, 0x7F, 0x17) :
                                new Color(0xC6, 0x28, 0x28);
                String badge = conf >= 70 ? "HIGH" : conf >= 40 ? "MEDIUM" : "LOW";

                g.setColor(bgColor);
                g.fillRoundRect(x, y, cellW, cellH, 8, 8);
                g.setColor(new Color(0xE0, 0xE0, 0xE0));
                g.drawRoundRect(x, y, cellW, cellH, 8, 8);

                // Question label
                g.setColor(new Color(0x99, 0x99, 0x99));
                g.setFont(new Font("SansSerif", Font.PLAIN, 10));
                FontMetrics fm = g.getFontMetrics();
                String qLabel = entry.getKey();
                g.drawString(qLabel, x + (cellW - fm.stringWidth(qLabel)) / 2, y + 16);

                // Confidence %
                g.setColor(textColor);
                g.setFont(new Font("SansSerif", Font.BOLD, 18));
                fm = g.getFontMetrics();
                String pctStr = conf + "%";
                g.drawString(pctStr, x + (cellW - fm.stringWidth(pctStr)) / 2, y + 40);

                // Badge
                g.setFont(new Font("SansSerif", Font.BOLD, 9));
                fm = g.getFontMetrics();
                g.drawString(badge, x + (cellW - fm.stringWidth(badge)) / 2, y + 58);

                idx++;
            }
            g.dispose();

            return imageToBase64(img);
        } catch (Exception e) {
            log.warn("Failed to generate confidence grid: {}", e.getMessage());
            return null;
        }
    }

    private String chartToBase64(JFreeChart chart, int width, int height) throws Exception {
        BufferedImage img = chart.createBufferedImage(width, height);
        return imageToBase64(img);
    }

    private String imageToBase64(BufferedImage img) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
    }
}
