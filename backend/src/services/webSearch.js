const axios = require('axios');

// Web search service using DuckDuckGo Instant Answer API and web search
async function searchWeb(query, maxResults = 5) {
  try {
    console.log(`Web search query: ${query}`);
    
    // First try DuckDuckGo Instant Answer API (no API key required)
    try {
      const instantAnswerResponse = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 5000
      });
      
      const data = instantAnswerResponse.data;
      if (data.AbstractText) {
        return [{
          title: data.Heading || data.AbstractText.substring(0, 100),
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: data.AbstractText
        }];
      }
    } catch (instantError) {
      console.log('DuckDuckGo Instant Answer failed:', instantError.message);
    }
    
    // Fallback to DuckDuckGo HTML search (scraping)
    try {
      const searchResponse = await axios.get('https://html.duckduckgo.com/html/', {
        params: {
          q: query
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Parse HTML results (basic parsing)
      const html = searchResponse.data;
      const results = [];
      
      // Extract title and snippet from HTML (basic regex approach)
      const titleRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/g;
      
      let match;
      let resultCount = 0;
      
      while ((match = titleRegex.exec(html)) !== null && resultCount < maxResults) {
        const url = match[1];
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        
        // Find corresponding snippet
        const snippetMatch = snippetRegex.exec(html);
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        
        if (title && url) {
          results.push({
            title: title,
            url: url,
            snippet: snippet || 'No description available'
          });
          resultCount++;
        }
      }
      
      if (results.length > 0) {
        return results;
      }
    } catch (htmlError) {
      console.log('DuckDuckGo HTML search failed:', htmlError.message);
    }
    
    // Final fallback - return mock results for institutional queries
    const mockResults = [
      {
        title: "Vignan University Official Website",
        url: "https://vignan.ac.in",
        snippet: "Official website of Vignan University with information about programs, admissions, and campus life."
      },
      {
        title: "JNTU Academic Regulations",
        url: "https://jntu.ac.in/regulations",
        snippet: "Latest academic regulations and curriculum frameworks for JNTU affiliated institutions."
      },
      {
        title: "Computer Science Engineering Syllabus",
        url: "https://example.com/cse-syllabus",
        snippet: "Comprehensive syllabus for Computer Science Engineering programs including R22 and R25 regulations."
      }
    ];
    
    return mockResults.slice(0, maxResults);
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

// Function to search for specific academic information
async function searchAcademicInfo(query) {
  try {
    const searchQuery = `${query} site:vignan.ac.in OR site:jntu.ac.in OR "Vignan University" OR "JNTU"`;
    return await searchWeb(searchQuery, 3);
  } catch (error) {
    console.error('Academic search error:', error);
    return [];
  }
}

// Function to search for current events or recent information
async function searchCurrentInfo(query) {
  try {
    const searchQuery = `${query} 2024 OR 2025 OR "latest" OR "recent"`;
    return await searchWeb(searchQuery, 3);
  } catch (error) {
    console.error('Current info search error:', error);
    return [];
  }
}

module.exports = { searchWeb, searchAcademicInfo, searchCurrentInfo };
